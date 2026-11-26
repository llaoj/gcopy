package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/server/auth"
)

func TestUserSessionLoginStatusAndLogoutFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	logger := newSilentLogger()
	store := sessions.NewCookieStore([]byte("test-secret-key-16"))
	s := &Server{
		wall:         NewWall(logger, 0),
		notifier:     NewNotifier(),
		config:       &config.Config{MaxContentLength: 1},
		log:          logger,
		sessionStore: store,
		tokenAuth:    auth.NewTokenAuth(store),
	}

	router := gin.New()
	v1 := router.Group("/api/v1")
	s.tokenAuth.RegisterRoutes(v1)
	v1.GET("/user", s.getUserHandler)
	v1.GET("/user/logout", s.logoutHandler)
	v1.Use(s.verifyAuthMiddleware)
	v1.GET("/clipboard", s.getClipboardHandler)
	v1.POST("/clipboard", s.updateClipboardHandler)

	// 1. Unauthenticated /api/v1/user returns 200 with loggedIn=false (not 404).
	recAnon := httptest.NewRecorder()
	router.ServeHTTP(recAnon, httptest.NewRequest(http.MethodGet, "/api/v1/user", nil))
	if recAnon.Code != http.StatusOK {
		t.Fatalf("anonymous /user status = %d, want 200", recAnon.Code)
	}
	var anonUser struct {
		UserID   string `json:"userId"`
		LoggedIn bool   `json:"loggedIn"`
	}
	if err := json.Unmarshal(recAnon.Body.Bytes(), &anonUser); err != nil {
		t.Fatalf("decode /user: %v", err)
	}
	if anonUser.LoggedIn || anonUser.UserID != "" {
		t.Fatalf("unexpected anonymous /user payload: %+v", anonUser)
	}

	// 2. Unauthenticated /api/v1/clipboard is rejected with 401.
	recUnauth := httptest.NewRecorder()
	router.ServeHTTP(recUnauth, httptest.NewRequest(http.MethodGet, "/api/v1/clipboard", nil))
	if recUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated /clipboard status = %d, want 401", recUnauth.Code)
	}

	// 3. Log in via token verify and capture session cookies.
	recLogin := httptest.NewRecorder()
	reqLogin := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/user/token/verify",
		strings.NewReader(`{"token":"G8K2P9X4"}`),
	)
	reqLogin.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recLogin, reqLogin)
	if recLogin.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", recLogin.Code, recLogin.Body.String())
	}
	cookies := recLogin.Result().Cookies()

	// 4. Authenticated /api/v1/user returns loggedIn=true and userId.
	recAuthed := httptest.NewRecorder()
	reqAuthed := httptest.NewRequest(http.MethodGet, "/api/v1/user", nil)
	for _, cookie := range cookies {
		reqAuthed.AddCookie(cookie)
	}
	router.ServeHTTP(recAuthed, reqAuthed)
	var authedUser struct {
		UserID   string `json:"userId"`
		LoggedIn bool   `json:"loggedIn"`
	}
	if err := json.Unmarshal(recAuthed.Body.Bytes(), &authedUser); err != nil {
		t.Fatalf("decode authed /user: %v", err)
	}
	if !authedUser.LoggedIn || authedUser.UserID != "G8K2P9X4" {
		t.Fatalf("unexpected authed /user payload: %+v", authedUser)
	}

	// 5. Session cookie authenticates /api/v1/clipboard upload & download.
	recPush := httptest.NewRecorder()
	reqPush := httptest.NewRequest(http.MethodPost, "/api/v1/clipboard", strings.NewReader("cookie sync"))
	for _, cookie := range cookies {
		reqPush.AddCookie(cookie)
	}
	router.ServeHTTP(recPush, reqPush)
	if recPush.Code != http.StatusOK {
		t.Fatalf("cookie push status = %d", recPush.Code)
	}

	// 6. Logout clears session and invalidates subsequent access.
	recLogout := httptest.NewRecorder()
	reqLogout := httptest.NewRequest(http.MethodGet, "/api/v1/user/logout", nil)
	for _, cookie := range cookies {
		reqLogout.AddCookie(cookie)
	}
	router.ServeHTTP(recLogout, reqLogout)
	if recLogout.Code != http.StatusOK {
		t.Fatalf("logout status = %d", recLogout.Code)
	}
	logoutCookies := recLogout.Result().Cookies()

	recAfterLogout := httptest.NewRecorder()
	reqAfterLogout := httptest.NewRequest(http.MethodGet, "/api/v1/clipboard", nil)
	for _, cookie := range logoutCookies {
		reqAfterLogout.AddCookie(cookie)
	}
	router.ServeHTTP(recAfterLogout, reqAfterLogout)
	if recAfterLogout.Code != http.StatusUnauthorized {
		t.Fatalf("post-logout /clipboard status = %d, want 401", recAfterLogout.Code)
	}
}
