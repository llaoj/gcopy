package auth

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
)

// TokenLength is the number of characters in a generated token.
const TokenLength = 8

// tokenPattern matches a token: alphanumeric characters only.
var tokenPattern = regexp.MustCompile(fmt.Sprintf("^[A-Za-z0-9]{%d}$", TokenLength))

// TokenAuth implements token-based authentication
type TokenAuth struct {
	sessionStore sessions.Store
	registry     tokenRegistry
}

// NewTokenAuth creates a new token authentication handler
func NewTokenAuth(store sessions.Store) *TokenAuth {
	return &TokenAuth{sessionStore: store}
}

// RegisterRoutes registers token authentication routes
func (a *TokenAuth) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/user/token/generate", a.generateTokenHandler)
	router.POST("/user/token/verify", a.verifyTokenHandler)
}

// TokenRequest represents the request body for token operations
type TokenRequest struct {
	Token string `form:"token" json:"token" binding:"required,len=8"`
}

// validateTokenFormat validates that a token contains only alphanumeric characters
func validateTokenFormat(token string) error {
	if len(token) != TokenLength {
		return fmt.Errorf("token must be exactly %d characters", TokenLength)
	}
	if !tokenPattern.MatchString(token) {
		return errors.New("token must contain only letters and numbers (A-Z, a-z, 0-9)")
	}
	return nil
}

// generateToken generates a token using crypto/rand
func generateToken() (string, error) {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	token := make([]byte, TokenLength)
	for i := range token {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		token[i] = charset[num.Int64()]
	}
	return string(token), nil
}

// generateTokenHandler generates a new unique token and stores it in the session
func (a *TokenAuth) generateTokenHandler(c *gin.Context) {
	token, err := a.registry.reserve()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session, err := a.sessionStore.Get(c.Request, UserSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session.Values["userId"] = token
	session.Values["loggedIn"] = true
	// Set session to expire in 7 days
	session.Options.MaxAge = sessionMaxAge

	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"userId": token,
	})
}

// verifyTokenHandler verifies an existing token and stores it in the session
func (a *TokenAuth) verifyTokenHandler(c *gin.Context) {
	var req TokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"message": fmt.Sprintf("Invalid token format: must be exactly %d characters", TokenLength)})
		return
	}

	// 后端校验：验证令牌格式（只允许字母和数字）
	if err := validateTokenFormat(req.Token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// For now, any valid token is considered valid
	// In a production system, you might want to validate against a database
	session, err := a.sessionStore.Get(c.Request, UserSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session.Values["userId"] = req.Token
	session.Values["loggedIn"] = true
	// Set session to expire in 7 days
	session.Options.MaxAge = sessionMaxAge

	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"userId":   req.Token,
		"loggedIn": true,
	})
}
