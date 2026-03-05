package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/llaoj/gcopy/internal/server/auth"
)

const userSessionName = "user_session"

func (s *Server) logoutHandler(c *gin.Context) {
	session, err := s.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	for key := range session.Values {
		delete(session.Values, key)
	}
	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Success"})
}

func (s *Server) getUserHandler(c *gin.Context) {
	session, err := s.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	userId, ok := auth.GetUserIdFromSession(session)
	if ok && auth.IsAuthenticated(session) {
		// Refresh session (sliding expiration)
		if err = session.Save(c.Request, c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}

		// Unified response format
		c.JSON(http.StatusOK, gin.H{
			"userId":   userId,
			"loggedIn": true,
			"authMode": s.authProvider.GetName(),
		})
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
}

func (s *Server) verifyAuthMiddleware(c *gin.Context) {
	session, err := s.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	userId, ok := auth.GetUserIdFromSession(session)
	if ok && auth.IsAuthenticated(session) {
		// Refresh session (sliding expiration)
		session.Save(c.Request, c.Writer)

		// Set unified user identifier
		c.Set("subject", userId)
		c.Next()
		return
	}

	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
}
