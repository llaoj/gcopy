package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/gcopy"
	applog "github.com/llaoj/gcopy/internal/log"
	"github.com/sirupsen/logrus"
)

func newFrontendTestRouter(assetFS fstest.MapFS) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	s := &Server{}
	r.NoRoute(s.frontendHandler(assetFS))
	return r
}

func TestFrontendHandlerServesTrailingSlashPages(t *testing.T) {
	assetFS := fstest.MapFS{
		"index.html":            {Data: []byte("<html>root</html>")},
		"user/token/index.html": {Data: []byte("<html>token</html>")},
		"user/token/index.txt":  {Data: []byte("rsc payload")},
		"_next/static/app.js":   {Data: []byte("console.log(1)")},
	}
	r := newFrontendTestRouter(assetFS)

	tests := []struct {
		path   string
		status int
		body   string
	}{
		{"/", http.StatusOK, "<html>root</html>"},
		{"/user/token/", http.StatusOK, "<html>token</html>"},
		{"/user/token/?token=abc", http.StatusOK, "<html>token</html>"},
		{"/user/token/index.html", http.StatusMovedPermanently, ""},
		{"/user/token/index.txt", http.StatusOK, "rsc payload"},
		{"/_next/static/app.js", http.StatusOK, "console.log(1)"},
		{"/nope/", http.StatusNotFound, ""},
		{"/nope", http.StatusNotFound, ""},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			r.ServeHTTP(w, req)

			if w.Code != tt.status {
				t.Fatalf("status = %d, want %d", w.Code, tt.status)
			}
			if tt.body != "" && w.Body.String() != tt.body {
				t.Fatalf("body = %q, want %q", w.Body.String(), tt.body)
			}
		})
	}
}

func TestFrontendHandlerRedirectsDirWithoutSlash(t *testing.T) {
	assetFS := fstest.MapFS{
		"index.html":            {Data: []byte("<html>root</html>")},
		"user/token/index.html": {Data: []byte("<html>token</html>")},
	}
	r := newFrontendTestRouter(assetFS)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/user/token", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusMovedPermanently {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusMovedPermanently)
	}
	if loc := w.Header().Get("Location"); loc != "token/" {
		t.Fatalf("Location = %q, want %q", loc, "token/")
	}
}

func TestClipboardStatusHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	wall := NewWall(applog.New(logrus.New(), "test-app-key"), 0)
	s := &Server{wall: wall}
	r := gin.New()
	// Mimic verifyAuthMiddleware so the handler sees a subject.
	r.Use(func(c *gin.Context) {
		c.Set("subject", "user1")
		c.Next()
	})
	r.GET("/status", s.getClipboardStatusHandler)

	read := func(t *testing.T) (int, string, string, string) {
		t.Helper()
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/status", nil)
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}

		var body struct {
			Index      int    `json:"index"`
			Type       string `json:"type"`
			ClientName string `json:"clientName"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		return body.Index, body.Type, body.ClientName, w.Header().Get("Cache-Control")
	}

	index, _, _, cache := read(t)
	if index != 0 {
		t.Fatalf("empty index = %d, want 0", index)
	}
	if cache != "no-store" {
		t.Fatalf("Cache-Control = %q, want %q", cache, "no-store")
	}

	wall.Set("user1", &gcopy.Clipboard{
		Index:      7,
		Type:       gcopy.TypeText,
		ClientName: "iOS Safari",
	})

	index, typ, clientName, _ := read(t)
	if index != 7 {
		t.Fatalf("index = %d, want 7", index)
	}
	if typ != gcopy.TypeText {
		t.Fatalf("type = %q, want %q", typ, gcopy.TypeText)
	}
	if clientName != "iOS Safari" {
		t.Fatalf("clientName = %q, want %q", clientName, "iOS Safari")
	}
}

func TestBearerTokenCurlPushAndPull(t *testing.T) {
	gin.SetMode(gin.TestMode)

	logger := newSilentLogger()
	s := &Server{
		wall:         NewWall(logger, 0),
		config:       &config.Config{MaxContentLength: 1},
		log:          logger,
		sessionStore: sessions.NewCookieStore([]byte("test-secret-key-16")),
	}

	r := gin.New()
	v1 := r.Group("/api/v1")
	v1.Use(s.verifyAuthMiddleware)
	v1.GET("/clipboard", s.getClipboardHandler)
	v1.POST("/clipboard", s.updateClipboardHandler)

	// 1. Invalid Bearer token is rejected with 401.
	wBad := httptest.NewRecorder()
	reqBad := httptest.NewRequest(http.MethodGet, "/api/v1/clipboard", nil)
	reqBad.Header.Set("Authorization", "Bearer bad!")
	r.ServeHTTP(wBad, reqBad)
	if wBad.Code != http.StatusUnauthorized {
		t.Fatalf("invalid bearer status = %d, want 401", wBad.Code)
	}

	// 2. Push plain text via curl-like request (no X-Type, default form Content-Type).
	wPush := httptest.NewRecorder()
	reqPush := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", strings.NewReader("hello from ssh"))
	reqPush.Header.Set("Authorization", "Bearer G8K2P9X4")
	reqPush.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqPush.Header.Set("User-Agent", "curl/8.7.1")
	r.ServeHTTP(wPush, reqPush)
	if wPush.Code != http.StatusOK {
		t.Fatalf("push status = %d, body = %s", wPush.Code, wPush.Body.String())
	}
	if wPush.Header().Get("X-Index") != "1" {
		t.Fatalf("X-Index = %q, want 1", wPush.Header().Get("X-Index"))
	}

	// 3. Pull back via Bearer token and verify inferred type, MIME, and clientName.
	wPull := httptest.NewRecorder()
	reqPull := httptest.NewRequest(http.MethodGet, "/api/v1/clipboard", nil)
	reqPull.Header.Set("Authorization", "Bearer G8K2P9X4")
	r.ServeHTTP(wPull, reqPull)
	if wPull.Code != http.StatusOK {
		t.Fatalf("pull status = %d, want 200", wPull.Code)
	}
	if got := wPull.Body.String(); got != "hello from ssh" {
		t.Fatalf("pull body = %q, want %q", got, "hello from ssh")
	}
	if got := wPull.Header().Get("X-Type"); got != gcopy.TypeText {
		t.Fatalf("X-Type = %q, want %q", got, gcopy.TypeText)
	}
	if got := wPull.Header().Get("X-ClientName"); got != "curl" {
		t.Fatalf("X-ClientName = %q, want %q", got, "curl")
	}
	if !strings.HasPrefix(wPull.Header().Get("Content-Type"), "text/plain") {
		t.Fatalf("Content-Type = %q, want text/plain*", wPull.Header().Get("Content-Type"))
	}

	// 4. Push named file without explicit X-Type infers TypeFile.
	wFile := httptest.NewRecorder()
	reqFile := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", bytes.NewReader([]byte{0x50, 0x4b}))
	reqFile.Header.Set("Authorization", "Bearer G8K2P9X4")
	reqFile.Header.Set("X-FileName", "archive.zip")
	r.ServeHTTP(wFile, reqFile)
	if wFile.Code != http.StatusOK {
		t.Fatalf("file push status = %d, body = %s", wFile.Code, wFile.Body.String())
	}
	cb := s.wall.Get("G8K2P9X4")
	if cb == nil || cb.Type != gcopy.TypeFile || cb.FileName != "archive.zip" {
		t.Fatalf("unexpected file clipboard: %+v", cb)
	}

	// 5. Simulate iOS Shortcuts PNG upload (Content-Type: image/png, no X-Type).
	wImg := httptest.NewRecorder()
	reqImg := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", bytes.NewReader([]byte{0x89, 0x50, 0x4e, 0x47}))
	reqImg.Header.Set("Authorization", "Bearer G8K2P9X4")
	reqImg.Header.Set("Content-Type", "image/png")
	reqImg.Header.Set("User-Agent", "BackgroundShortcutRunner/2302.0.4 CFNetwork/1496.0.7 Darwin/23.5.0")
	r.ServeHTTP(wImg, reqImg)
	if wImg.Code != http.StatusOK {
		t.Fatalf("iOS Shortcuts image push status = %d, body = %s", wImg.Code, wImg.Body.String())
	}
	cbImg := s.wall.Get("G8K2P9X4")
	if cbImg == nil || cbImg.Type != gcopy.TypeScreenshot || cbImg.MIMEType != "image/png" {
		t.Fatalf("unexpected iOS Shortcuts image clipboard: %+v", cbImg)
	}
}
