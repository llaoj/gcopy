package server

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/gcopy"
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
		"manifest.json":         {Data: []byte(`{"name":"GCopy"}`)},
		"sw.js":                 {Data: []byte("// sw")},
		"apple-touch-icon.png":  {Data: []byte("png")},
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
		{"/manifest.json", http.StatusOK, `{"name":"GCopy"}`},
		{"/sw.js", http.StatusOK, "// sw"},
		{"/apple-touch-icon.png", http.StatusOK, "png"},
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
	reqFile.Header.Set(gcopy.HeaderFileName, "archive.zip")
	r.ServeHTTP(wFile, reqFile)
	if wFile.Code != http.StatusOK {
		t.Fatalf("file push status = %d, body = %s", wFile.Code, wFile.Body.String())
	}
	clipboard := s.wall.Get("G8K2P9X4")
	if clipboard == nil || clipboard.Type != gcopy.TypeFile || clipboard.FileName != "archive.zip" {
		t.Fatalf("unexpected file clipboard: %+v", clipboard)
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
	imageClipboard := s.wall.Get("G8K2P9X4")
	if imageClipboard == nil || imageClipboard.Type != gcopy.TypeScreenshot || imageClipboard.MIMEType != "image/png" {
		t.Fatalf("unexpected iOS Shortcuts image clipboard: %+v", imageClipboard)
	}
}

func TestSystemInfoHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	s := &Server{config: &config.Config{MaxContentLength: 25}}
	router := gin.New()
	router.GET("/api/v1/systeminfo", s.getSystemInfoHandler)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/systeminfo", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var info struct {
		Time             string `json:"time"`
		MaxContentLength int    `json:"maxContentLength"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &info); err != nil {
		t.Fatalf("decode systeminfo: %v", err)
	}
	if info.MaxContentLength != 25 || info.Time == "" {
		t.Fatalf("unexpected systeminfo: %+v", info)
	}
}

func TestClipboardEdgeCasesAndConcurrency(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger := newSilentLogger()
	s := &Server{
		wall:         NewWall(logger, 0),
		notifier:     NewNotifier(),
		config:       &config.Config{MaxContentLength: 1}, // 1 MiB cap
		log:          logger,
		sessionStore: sessions.NewCookieStore([]byte("test-secret-key-16")),
	}

	router := gin.New()
	v1 := router.Group("/api/v1")
	v1.Use(s.verifyAuthMiddleware)
	v1.GET("/clipboard", s.getClipboardHandler)
	v1.POST("/clipboard", s.updateClipboardHandler)

	// 1. Empty wall returns X-Index: 0 and empty body.
	recEmpty := httptest.NewRecorder()
	reqEmpty := httptest.NewRequest(http.MethodGet, "/api/v1/clipboard", nil)
	reqEmpty.Header.Set("Authorization", "Bearer G8K2P9X4")
	router.ServeHTTP(recEmpty, reqEmpty)
	if recEmpty.Code != http.StatusOK || recEmpty.Header().Get(gcopy.HeaderIndex) != "0" || recEmpty.Body.Len() != 0 {
		t.Fatalf("empty pull: code=%d index=%q len=%d", recEmpty.Code, recEmpty.Header().Get(gcopy.HeaderIndex), recEmpty.Body.Len())
	}

	// 2. Reject invalid X-Type (400) and file without X-FileName (400).
	recBadType := httptest.NewRecorder()
	reqBadType := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", strings.NewReader("data"))
	reqBadType.Header.Set("Authorization", "Bearer G8K2P9X4")
	reqBadType.Header.Set(gcopy.HeaderType, "video")
	router.ServeHTTP(recBadType, reqBadType)
	if recBadType.Code != http.StatusBadRequest {
		t.Fatalf("invalid X-Type status = %d, want 400", recBadType.Code)
	}

	recMissingFileName := httptest.NewRecorder()
	reqMissingFileName := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", strings.NewReader("data"))
	reqMissingFileName.Header.Set("Authorization", "Bearer G8K2P9X4")
	reqMissingFileName.Header.Set(gcopy.HeaderType, gcopy.TypeFile)
	router.ServeHTTP(recMissingFileName, reqMissingFileName)
	if recMissingFileName.Code != http.StatusBadRequest {
		t.Fatalf("missing X-FileName status = %d, want 400", recMissingFileName.Code)
	}

	// 3. Reject payload exceeding MaxContentLength (1 MiB) with 413.
	oversized := bytes.Repeat([]byte("a"), 1024*1024+1)
	recTooLarge := httptest.NewRecorder()
	reqTooLarge := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", bytes.NewReader(oversized))
	reqTooLarge.Header.Set("Authorization", "Bearer G8K2P9X4")
	router.ServeHTTP(recTooLarge, reqTooLarge)
	if recTooLarge.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized status = %d, want 413", recTooLarge.Code)
	}

	// 4. Upload a file, verify Content-Disposition on pull, and verify X-Index short-circuit.
	recFilePush := httptest.NewRecorder()
	reqFilePush := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", strings.NewReader("pdf-bytes"))
	reqFilePush.Header.Set("Authorization", "Bearer G8K2P9X4")
	reqFilePush.Header.Set(gcopy.HeaderType, gcopy.TypeFile)
	reqFilePush.Header.Set(gcopy.HeaderFileName, "report.pdf")
	router.ServeHTTP(recFilePush, reqFilePush)
	if recFilePush.Code != http.StatusOK {
		t.Fatalf("file push status = %d", recFilePush.Code)
	}

	recFilePull := httptest.NewRecorder()
	reqFilePull := httptest.NewRequest(http.MethodGet, "/api/v1/clipboard", nil)
	reqFilePull.Header.Set("Authorization", "Bearer G8K2P9X4")
	router.ServeHTTP(recFilePull, reqFilePull)
	if got := recFilePull.Header().Get("Content-Disposition"); got != `attachment; filename="report.pdf"` {
		t.Fatalf("Content-Disposition = %q", got)
	}

	recUpToDate := httptest.NewRecorder()
	reqUpToDate := httptest.NewRequest(http.MethodGet, "/api/v1/clipboard", nil)
	reqUpToDate.Header.Set("Authorization", "Bearer G8K2P9X4")
	reqUpToDate.Header.Set(gcopy.HeaderIndex, "1")
	router.ServeHTTP(recUpToDate, reqUpToDate)
	if recUpToDate.Code != http.StatusOK || recUpToDate.Body.Len() != 0 || recUpToDate.Header().Get(gcopy.HeaderIndex) != "1" {
		t.Fatalf("up-to-date pull should return empty body with X-Index=1, got code=%d len=%d", recUpToDate.Code, recUpToDate.Body.Len())
	}

	// 5. Concurrent uploads serialize Index monotonically without collision.
	const workers = 10
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", strings.NewReader("concurrent"))
			req.Header.Set("Authorization", "Bearer G8K2P9X4")
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Errorf("concurrent push status = %d", rec.Code)
			}
		}()
	}
	wg.Wait()

	if latest := s.wall.Get("G8K2P9X4"); latest == nil || latest.Index != 1+workers {
		t.Fatalf("expected final Index=%d after concurrent uploads, got %+v", 1+workers, latest)
	}
}

func TestParseClientName(t *testing.T) {
	longAgent := strings.Repeat("CustomAutomationClient", 3) + "/1.0"
	if got := parseClientName(longAgent); len(got) != 32 {
		t.Fatalf("expected long client name truncated to 32 chars, got len=%d (%q)", len(got), got)
	}
	if got := parseClientName("curl/8.7.1"); got != "curl" {
		t.Fatalf("parseClientName(curl) = %q, want curl", got)
	}
	if got := parseClientName(""); got != "" {
		t.Fatalf("parseClientName(empty) = %q, want empty", got)
	}
	browserUA := "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
	if got := parseClientName(browserUA); !strings.Contains(got, "Chrome") {
		t.Fatalf("parseClientName(Chrome UA) = %q, expected to contain Chrome", got)
	}
}

func TestSecurityAndCacheMiddlewares(t *testing.T) {
	gin.SetMode(gin.TestMode)
	s := &Server{}
	router := gin.New()
	router.Use(s.securityHeadersMiddleware())
	router.Use(s.cacheMiddleware())
	router.GET("/_next/static/chunk.js", func(c *gin.Context) { c.String(http.StatusOK, "js") })
	router.GET("/", func(c *gin.Context) { c.String(http.StatusOK, "html") })

	// Plain HTTP: nosniff set, HSTS omitted, non-static route gets no-cache.
	recHTTP := httptest.NewRecorder()
	router.ServeHTTP(recHTTP, httptest.NewRequest(http.MethodGet, "/", nil))
	if recHTTP.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("missing X-Content-Type-Options: nosniff")
	}
	if recHTTP.Header().Get("Strict-Transport-Security") != "" {
		t.Fatal("HSTS should not be set over plain HTTP")
	}
	if recHTTP.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("Cache-Control = %q, want no-cache", recHTTP.Header().Get("Cache-Control"))
	}

	// HTTPS (direct TLS or X-Forwarded-Proto) + immutable static asset cache.
	recHTTPS := httptest.NewRecorder()
	reqHTTPS := httptest.NewRequest(http.MethodGet, "/_next/static/chunk.js", nil)
	reqHTTPS.TLS = &tls.ConnectionState{}
	router.ServeHTTP(recHTTPS, reqHTTPS)
	if !strings.Contains(recHTTPS.Header().Get("Strict-Transport-Security"), "max-age=31536000") {
		t.Fatalf("expected HSTS header on TLS request, got %q", recHTTPS.Header().Get("Strict-Transport-Security"))
	}
	if recHTTPS.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatalf("static Cache-Control = %q", recHTTPS.Header().Get("Cache-Control"))
	}
}
