package auth

import (
	"github.com/gorilla/sessions"
)

// UserSessionName is the session cookie name.
const UserSessionName = "user_session"

// sessionMaxAge is the session lifetime in seconds.
const sessionMaxAge = 7 * 24 * 3600

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
