package auth

import (
	"net/http"

	"github.com/gorilla/sessions"
)

// UserSessionName is the session cookie name.
const UserSessionName = "user_session"

// sessionMaxAge is the session lifetime in seconds.
const sessionMaxAge = 7 * 24 * 3600

// GetSession returns the named session for the request. A cookie that cannot be
// decoded (for example after the app-key was rotated, or a stray cookie with the
// same name) is not an error: it is discarded and a fresh, empty session is
// returned, so the caller can Save to overwrite the bad cookie.
func GetSession(store sessions.Store, r *http.Request, name string) (*sessions.Session, error) {
	session, err := store.Get(r, name)
	if err != nil {
		if session == nil {
			// Defensive: rebuild a clean session if the store returned none.
			return store.New(r, name)
		}
		// Reuse the fresh, empty session the store returned alongside the error.
		return session, nil
	}
	return session, nil
}

// GetUserIdFromSession extracts the unified userId from session
func GetUserIdFromSession(session *sessions.Session) (string, bool) {
	userId, ok := session.Values["userId"].(string)
	return userId, ok && userId != ""
}

// IsAuthenticated checks if the session has valid authentication
func IsAuthenticated(session *sessions.Session) bool {
	_, ok := GetUserIdFromSession(session)
	return ok && session.Values["loggedIn"] == true
}
