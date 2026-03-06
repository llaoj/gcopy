package auth

import (
	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
)

// UserSessionName is the shared session cookie name used by all auth providers
const UserSessionName = "user_session"

// AuthProvider defines the interface for authentication providers
type AuthProvider interface {
	// GetName returns the authentication mode name (e.g., "email", "token")
	GetName() string

	// RegisterRoutes registers authentication-related routes
	RegisterRoutes(router *gin.RouterGroup)
}

// AuthProviderBase provides common functionality for auth providers
type AuthProviderBase struct {
	sessionStore sessions.Store
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
