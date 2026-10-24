package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
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

	wall := NewWall(applog.New(logrus.New(), "test-app-key"))
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
