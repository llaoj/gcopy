package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
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
