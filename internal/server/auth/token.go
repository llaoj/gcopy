package auth

import (
	"crypto/rand"
	"errors"
	"math/big"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/llaoj/gcopy/internal/config"
)

// TokenAuthProvider implements token-based authentication
type TokenAuthProvider struct {
	AuthProviderBase
	config *config.Config
}

// NewTokenAuthProvider creates a new token authentication provider
func NewTokenAuthProvider(cfg *config.Config, store sessions.Store) *TokenAuthProvider {
	return &TokenAuthProvider{
		AuthProviderBase: AuthProviderBase{sessionStore: store},
		config:           cfg,
	}
}

// GetName returns "token"
func (p *TokenAuthProvider) GetName() string {
	return "token"
}

// RegisterRoutes registers token authentication routes
func (p *TokenAuthProvider) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/user/token/generate", p.generateTokenHandler)
	router.POST("/user/token/verify", p.verifyTokenHandler)
}

// TokenRequest represents the request body for token operations
type TokenRequest struct {
	Token string `form:"token" json:"token" binding:"required,len=6"`
}

// validateTokenFormat validates that a token contains only alphanumeric characters
func validateTokenFormat(token string) error {
	if len(token) != 6 {
		return errors.New("token must be exactly 6 characters")
	}
	matched, err := regexp.MatchString("^[A-Za-z0-9]{6}$", token)
	if err != nil {
		return err
	}
	if !matched {
		return errors.New("token must contain only letters and numbers (A-Z, a-z, 0-9)")
	}
	return nil
}

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

// generateTokenHandler generates a new token and stores it in the session
func (p *TokenAuthProvider) generateTokenHandler(c *gin.Context) {
	token, err := generateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session, err := p.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session.Values["userId"] = token
	session.Values["loggedIn"] = true
	// Set session to expire in 7 days
	session.Options.MaxAge = 7 * 24 * 3600

	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"userId":  token,
		"warning": "Please keep the token secure. Token leakage may lead to data breaches. Recommended for intranet environments.",
	})
}

// verifyTokenHandler verifies an existing token and stores it in the session
func (p *TokenAuthProvider) verifyTokenHandler(c *gin.Context) {
	var req TokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"message": "Invalid token format: must be exactly 6 characters"})
		return
	}

	// 后端校验：验证令牌格式（只允许字母和数字）
	if err := validateTokenFormat(req.Token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// For now, any valid 6-character token is considered valid
	// In a production system, you might want to validate against a database
	session, err := p.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session.Values["userId"] = req.Token
	session.Values["loggedIn"] = true
	// Set session to expire in 7 days
	session.Options.MaxAge = 7 * 24 * 3600

	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"userId":   req.Token,
		"loggedIn": true,
	})
}
