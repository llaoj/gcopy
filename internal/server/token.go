package server

import (
	"crypto/rand"
	"math/big"
	"net/http"

	"github.com/gin-gonic/gin"
)

// generateToken generates a 6-character token using crypto/rand
func generateToken() (string, error) {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	token := make([]byte, 6)
	for i := range token {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		token[i] = charset[num.Int64()]
	}
	return string(token), nil
}

// TokenRequest represents the request body for token operations
type TokenRequest struct {
	Token string `form:"token" json:"token" binding:"omitempty,len=6"`
}

// generateTokenHandler generates a new token and stores it in the session
func (s *Server) generateTokenHandler(c *gin.Context) {
	token, err := generateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session, err := s.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session.Values["token"] = token
	session.Values["loggedIn"] = true
	// Set session to expire in 7 days
	session.Options.MaxAge = 7 * 24 * 3600

	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":   token,
		"warning": "Please keep the token secure. Token leakage may lead to data breaches. Recommended for intranet environments.",
	})
}

// verifyTokenHandler verifies an existing token and stores it in the session
func (s *Server) verifyTokenHandler(c *gin.Context) {
	var req TokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"message": err.Error()})
		return
	}

	// For now, any 6-character token is considered valid
	// In a production system, you might want to validate against a database
	session, err := s.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session.Values["token"] = req.Token
	session.Values["loggedIn"] = true
	// Set session to expire in 7 days
	session.Options.MaxAge = 7 * 24 * 3600

	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":    req.Token,
		"loggedIn": true,
	})
}
