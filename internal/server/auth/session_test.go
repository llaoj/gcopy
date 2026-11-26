package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/sessions"
)

func TestGetSessionHandlesValidAndCorruptCookies(t *testing.T) {
	store := sessions.NewCookieStore([]byte("test-secret-key-16"))

	// 1. Fresh request without cookie yields a clean session.
	reqEmpty := httptest.NewRequest(http.MethodGet, "/", nil)
	sessionEmpty, err := GetSession(store, reqEmpty, UserSessionName)
	if err != nil {
		t.Fatalf("GetSession(empty) error = %v", err)
	}
	if IsAuthenticated(sessionEmpty) {
		t.Fatal("expected empty session to be unauthenticated")
	}

	// 2. Save authenticated session and read it back.
	rec := httptest.NewRecorder()
	sessionEmpty.Values[SessionKeyUserID] = "G8K2P9X4"
	sessionEmpty.Values[SessionKeyLoggedIn] = true
	if err := sessionEmpty.Save(reqEmpty, rec); err != nil {
		t.Fatalf("Save error = %v", err)
	}

	reqValid := httptest.NewRequest(http.MethodGet, "/", nil)
	for _, cookie := range rec.Result().Cookies() {
		reqValid.AddCookie(cookie)
	}
	sessionValid, err := GetSession(store, reqValid, UserSessionName)
	if err != nil {
		t.Fatalf("GetSession(valid) error = %v", err)
	}
	if !IsAuthenticated(sessionValid) {
		t.Fatal("expected saved session to be authenticated")
	}

	// 3. Corrupt cookie or rotated app-key on a new request must be discarded cleanly without error.
	reqRotated := httptest.NewRequest(http.MethodGet, "/", nil)
	for _, cookie := range rec.Result().Cookies() {
		reqRotated.AddCookie(cookie)
	}
	rotatedStore := sessions.NewCookieStore([]byte("rotated-secret-key"))
	sessionRotated, err := GetSession(rotatedStore, reqRotated, UserSessionName)
	if err != nil {
		t.Fatalf("GetSession(rotated) should discard bad cookie without error, got %v", err)
	}
	if IsAuthenticated(sessionRotated) {
		t.Fatal("session decoded with rotated key must not be authenticated")
	}

	reqMalformed := httptest.NewRequest(http.MethodGet, "/", nil)
	reqMalformed.AddCookie(&http.Cookie{Name: UserSessionName, Value: "not-a-valid-cookie"})
	sessionMalformed, err := GetSession(store, reqMalformed, UserSessionName)
	if err != nil || IsAuthenticated(sessionMalformed) {
		t.Fatalf("expected malformed cookie to yield fresh unauthenticated session, err=%v", err)
	}
}

func TestGetUserIDFromSession(t *testing.T) {
	tests := []struct {
		name   string
		userID string
		wantOK bool
	}{
		{name: "token", userID: "ABC12345", wantOK: true},
		{name: "legacy non-token", userID: "user@example.com", wantOK: false},
		{name: "empty", userID: "", wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			session := &sessions.Session{
				Values: map[interface{}]interface{}{
					SessionKeyUserID:   tt.userID,
					SessionKeyLoggedIn: true,
				},
			}

			userID, ok := GetUserIDFromSession(session)
			if ok != tt.wantOK {
				t.Fatalf("GetUserIDFromSession ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && userID != tt.userID {
				t.Fatalf("userID = %q, want %q", userID, tt.userID)
			}
			if IsAuthenticated(session) != tt.wantOK {
				t.Fatalf("IsAuthenticated = %v, want %v", IsAuthenticated(session), tt.wantOK)
			}
		})
	}
}
