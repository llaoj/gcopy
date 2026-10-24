package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/llaoj/gcopy/internal/server/auth"
)

func (s *Server) logoutHandler(c *gin.Context) {
	session, err := auth.GetSession(s.sessionStore, c.Request, auth.UserSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load session"})
		return
	}

	for key := range session.Values {
		delete(session.Values, key)
	}
	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Success"})
}

func (s *Server) getUserHandler(c *gin.Context) {
	session, err := auth.GetSession(s.sessionStore, c.Request, auth.UserSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to load session"})
		return
	}

	userId, ok := auth.GetUserIdFromSession(session)
	if ok && auth.IsAuthenticated(session) {
		// Refresh session (sliding expiration)
		if err = session.Save(c.Request, c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to save session"})
			return
		}

		s.log.Analytics("active", userId, nil)

		// Unified response format
		c.JSON(http.StatusOK, gin.H{
			"userId":   userId,
			"loggedIn": true,
		})
		return
	}

	// Not logged in: return an explicit unauthenticated state instead of 404
	// to avoid noisy "404" console errors in browsers (especially Safari).
	c.JSON(http.StatusOK, gin.H{
		"userId":   "",
		"loggedIn": false,
	})
}

func (s *Server) verifyAuthMiddleware(c *gin.Context) {
	session, err := auth.GetSession(s.sessionStore, c.Request, auth.UserSessionName)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}

	userId, ok := auth.GetUserIdFromSession(session)
	if ok && auth.IsAuthenticated(session) {
		// Refresh session (sliding expiration)
		if err := session.Save(c.Request, c.Writer); err != nil {
			s.log.Warnf("Failed to save session in middleware: %v", err)
		}

		// Set unified user identifier
		c.Set("subject", userId)
		c.Next()
		return
	}

	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
}
