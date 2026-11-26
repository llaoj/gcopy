package server

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/llaoj/gcopy/internal/config"
)

func TestNotifierSubscribeCoalesceAndCap(t *testing.T) {
	notifier := NewNotifier()

	listener1, unsubscribe1, ok := notifier.Subscribe("G8K2P9X4")
	if !ok {
		t.Fatalf("expected first subscribe to succeed")
	}
	listener2, unsubscribe2, ok := notifier.Subscribe("G8K2P9X4")
	if !ok {
		t.Fatalf("expected second subscribe to succeed")
	}
	if got := notifier.SubscriberCount("G8K2P9X4"); got != 2 {
		t.Fatalf("SubscriberCount = %d, want 2", got)
	}

	// Rapid updates without reading should coalesce to the latest index without blocking.
	notifier.Notify("G8K2P9X4", ClipboardEvent{Index: 1, Type: "text"})
	notifier.Notify("G8K2P9X4", ClipboardEvent{Index: 2, Type: "screenshot", ClientName: "macOS Chrome"})

	got1 := <-listener1
	got2 := <-listener2
	if got1.Index != 2 || got2.Index != 2 {
		t.Fatalf("expected coalesced Index=2, got %+v and %+v", got1, got2)
	}

	// Enforce per-user cap (maxSubscribersPerUser = 16; 2 already active).
	unsubscribes := []func(){unsubscribe1, unsubscribe2}
	for i := 2; i < maxSubscribersPerUser; i++ {
		_, unsubscribe, ok := notifier.Subscribe("G8K2P9X4")
		if !ok {
			t.Fatalf("subscribe #%d failed unexpectedly", i+1)
		}
		unsubscribes = append(unsubscribes, unsubscribe)
	}
	if _, _, ok := notifier.Subscribe("G8K2P9X4"); ok {
		t.Fatalf("expected subscribe beyond maxSubscribersPerUser to be rejected")
	}

	for _, unsubscribe := range unsubscribes {
		unsubscribe()
	}
	if got := notifier.SubscriberCount("G8K2P9X4"); got != 0 {
		t.Fatalf("SubscriberCount after cleanup = %d, want 0", got)
	}
}

func TestClipboardEventsSSEStream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	logger := newSilentLogger()
	s := &Server{
		wall:         NewWall(logger, 0),
		notifier:     NewNotifier(),
		config:       &config.Config{MaxContentLength: 1},
		log:          logger,
		sessionStore: sessions.NewCookieStore([]byte("test-secret-key-16")),
	}

	r := gin.New()
	v1 := r.Group("/api/v1")
	v1.Use(s.verifyAuthMiddleware)
	v1.GET("/clipboard/events", s.getClipboardEventsHandler)
	v1.POST("/clipboard", s.updateClipboardHandler)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Use httptest.Recorder with a pipe-backed ResponseWriter or test against
	// a custom flushing recorder.
	reqEvents := httptest.NewRequest(http.MethodGet, "/api/v1/clipboard/events", nil).WithContext(ctx)
	reqEvents.Header.Set("Authorization", "Bearer G8K2P9X4")

	pr, pw := newStreamingRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		r.ServeHTTP(pw, reqEvents)
		_ = pw.Close()
	}()

	reader := bufio.NewReader(pr)
	readEvent := func() ClipboardEvent {
		t.Helper()
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				t.Fatalf("read SSE line failed: %v", err)
			}
			if strings.HasPrefix(line, "data: ") {
				raw := strings.TrimSpace(strings.TrimPrefix(line, "data: "))
				var event ClipboardEvent
				if err := json.Unmarshal([]byte(raw), &event); err != nil {
					t.Fatalf("decode SSE JSON %q: %v", raw, err)
				}
				return event
			}
		}
	}

	// 1. Initial snapshot event on connect should report Index = 0.
	initial := readEvent()
	if initial.Index != 0 {
		t.Fatalf("initial SSE index = %d, want 0", initial.Index)
	}

	// 2. Uploading a clipboard should push Index = 1 immediately over the stream.
	wPush := httptest.NewRecorder()
	reqPush := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", strings.NewReader("instant push"))
	reqPush.Header.Set("Authorization", "Bearer G8K2P9X4")
	reqPush.Header.Set("User-Agent", "curl/8.7.1")
	r.ServeHTTP(wPush, reqPush)
	if wPush.Code != http.StatusOK {
		t.Fatalf("push status = %d", wPush.Code)
	}

	updated := readEvent()
	if updated.Index != 1 || updated.Type != "text" || updated.ClientName != "curl" {
		t.Fatalf("unexpected SSE update: %+v", updated)
	}

	// 3. Cancelling client context exits handler and cleans up subscriber.
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("SSE handler did not exit after context cancellation")
	}
	if got := s.notifier.SubscriberCount("G8K2P9X4"); got != 0 {
		t.Fatalf("SubscriberCount after disconnect = %d, want 0", got)
	}
}

type streamingRecorder struct {
	header http.Header
	pw     *bufioWriterPipe
	code   int
}

type bufioWriterPipe struct {
	ch     chan []byte
	closed chan struct{}
	once   chan struct{}
}

func newStreamingRecorder() (*pipeReader, *streamingRecorder) {
	ch := make(chan []byte, 32)
	closed := make(chan struct{})
	return &pipeReader{ch: ch, closed: closed}, &streamingRecorder{
		header: make(http.Header),
		pw:     &bufioWriterPipe{ch: ch, closed: closed},
		code:   http.StatusOK,
	}
}

func (s *streamingRecorder) Header() http.Header        { return s.header }
func (s *streamingRecorder) WriteHeader(statusCode int) { s.code = statusCode }
func (s *streamingRecorder) Flush()                     {}
func (s *streamingRecorder) Close() error               { close(s.pw.closed); return nil }
func (s *streamingRecorder) Write(p []byte) (int, error) {
	cp := append([]byte(nil), p...)
	s.pw.ch <- cp
	return len(p), nil
}

type pipeReader struct {
	ch     chan []byte
	closed chan struct{}
	buf    []byte
}

func (r *pipeReader) Read(p []byte) (int, error) {
	if len(r.buf) == 0 {
		select {
		case chunk := <-r.ch:
			r.buf = chunk
		case <-r.closed:
			return 0, context.Canceled
		}
	}
	n := copy(p, r.buf)
	r.buf = r.buf[n:]
	return n, nil
}
