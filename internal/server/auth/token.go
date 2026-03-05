package auth

import (
	"crypto/rand"
	"math/big"
	"net/http"
	"strings"

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
	Token string `form:"token" json:"token" binding:"omitempty,len=6"`
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

	// Check language for localized warning message
	language := c.Request.Header.Get("Accept-Language")
	var warning, warningEn string
	if strings.HasPrefix(language, "zh-CN") {
		warning = "请妥善保管令牌，令牌泄露可能导致数据泄露。推荐在内网环境使用。"
		warningEn = "Please keep the token secure. Token leakage may lead to data breaches. Recommended for intranet environments."
	} else {
		warning = "Please keep the token secure. Token leakage may lead to data breaches. Recommended for intranet environments."
		warningEn = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"userId":    token,
		"warning":   warning,
		"warningEn": warningEn,
	})
}

// verifyTokenHandler verifies an existing token and stores it in the session
func (p *TokenAuthProvider) verifyTokenHandler(c *gin.Context) {
	var req TokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"message": err.Error()})
		return
	}

	// For now, any 6-character token is considered valid
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
