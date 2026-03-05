package auth

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/mileusna/useragent"
	"gopkg.in/gomail.v2"
)

const userSessionName = "user_session"

// EmailAuthProvider implements email-based authentication
type EmailAuthProvider struct {
	AuthProviderBase
	config *config.Config
}

// NewEmailAuthProvider creates a new email authentication provider
func NewEmailAuthProvider(cfg *config.Config, store sessions.Store) *EmailAuthProvider {
	return &EmailAuthProvider{
		AuthProviderBase: AuthProviderBase{sessionStore: store},
		config:           cfg,
	}
}

// GetName returns "email"
func (p *EmailAuthProvider) GetName() string {
	return "email"
}

// RegisterRoutes registers email authentication routes
func (p *EmailAuthProvider) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/user/email/code", p.emailCodeHandler)
	router.POST("/user/email/verify", p.loginHandler)
}

// Login represents the request body for email login
type Login struct {
	Email string `form:"email" json:"email" xml:"email" binding:"required,email"`
	Code  string `form:"code" json:"code" xml:"password" binding:"omitempty,numeric,len=6"`
}

// emailCodeHandler sends verification code to email
func (p *EmailAuthProvider) emailCodeHandler(c *gin.Context) {
	var login Login
	if err := c.ShouldBindJSON(&login); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"message": err.Error()})
		return
	}

	var code string
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	for i := 0; i < 6; i++ {
		code += strconv.Itoa(r.Intn(10))
	}
	ua := useragent.Parse(c.Request.Header.Get("User-Agent"))
	language := c.Request.Header.Get("Accept-Language")
	var subject, body string
	if strings.HasPrefix(language, "zh-CN") {
		subject = fmt.Sprintf("%s是您的验证码", code)
		body = fmt.Sprintf("请输入您的验证码: %s. 该验证码有效期5分钟. 为保护您的账户, 请不要分享这个验证码.", code)
		if ua.OS != "" {
			body += "<br>请求自 " + ua.OS
			if ua.Name != "" {
				body += fmt.Sprintf(" %s", ua.Name)
			}
			body += "."
		}
	} else {
		subject = fmt.Sprintf("%s is your verification code", code)
		body = fmt.Sprintf("Enter the verification code when prompted: %s. Code will expire in 5 minutes. To protect your account, do not share this code.", code)
		if ua.OS != "" {
			body += "<br>Requested from " + ua.OS
			if ua.Name != "" {
				body += fmt.Sprintf(" %s", ua.Name)
			}
			body += "."
		}
	}
	message := gomail.NewMessage()
	message.SetHeader("From", message.FormatAddress(p.config.SMTPSender, "GCopy"))
	message.SetHeader("To", login.Email)
	message.SetHeader("Subject", subject)
	message.SetBody("text/html", body)

	dialer := gomail.NewDialer(p.config.SMTPHost, p.config.SMTPPort, p.config.SMTPUsername, p.config.SMTPPassword)
	dialer.SSL = p.config.SMTPSSL
	if err := dialer.DialAndSend(message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session, err := p.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	session.Values["email"] = login.Email
	session.Values["code"] = code
	session.Values["loggedIn"] = false
	session.Values["validateAt"] = time.Now().Unix()
	if err = session.Save(c.Request, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Success"})
}

// loginHandler verifies the email verification code
func (p *EmailAuthProvider) loginHandler(c *gin.Context) {
	var login Login
	if err := c.ShouldBindJSON(&login); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"message": err.Error()})
		return
	}

	session, err := p.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	if session.Values["loggedIn"] == true {
		c.JSON(http.StatusOK, gin.H{
			"userId":   login.Email,
			"loggedIn": true,
		})
		return
	}

	if login.Email == session.Values["email"] && login.Code == session.Values["code"] && time.Now().Unix()-session.Values["validateAt"].(int64) <= 5*60 {
		session.Values["userId"] = login.Email
		session.Values["loggedIn"] = true
		session.Values["validateAt"] = time.Now().Unix()
		// Set session to expire in 7 days
		session.Options.MaxAge = 7 * 24 * 3600
		delete(session.Values, "code")
		if err = session.Save(c.Request, c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"userId":   login.Email,
			"loggedIn": true,
		})
		return
	}

	c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
}
