package server

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mileusna/useragent"
	"gopkg.in/gomail.v2"
)

const userSessionName = "user_session"

type Login struct {
	Email string `form:"email" json:"email" xml:"email"  binding:"required,email"`
	Code  string `form:"code" json:"code" xml:"password" binding:"omitempty,numeric,len=6"`
}

func (s *Server) emailCodeHandler(c *gin.Context) {
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
	message.SetHeader("From", message.FormatAddress(s.config.SMTPSender, "GCopy"))
	message.SetHeader("To", login.Email)
	message.SetHeader("Subject", subject)
	message.SetBody("text/html", body)

	dialer := gomail.NewDialer(s.config.SMTPHost, s.config.SMTPPort, s.config.SMTPUsername, s.config.SMTPPassword)
	dialer.SSL = s.config.SMTPSSL
	if err := dialer.DialAndSend(message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	session, err := s.sessionStore.Get(c.Request, userSessionName)
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

func (s *Server) loginHandler(c *gin.Context) {
	var login Login
	if err := c.ShouldBindJSON(&login); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"message": err.Error()})
		return
	}

	session, err := s.sessionStore.Get(c.Request, userSessionName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	if session.Values["loggedIn"] == true {
		c.JSON(http.StatusOK, gin.H{
			"email":    login.Email,
			"loggedIn": true,
		})
		return
	}

	if login.Email == session.Values["email"] && login.Code == session.Values["code"] && time.Now().Unix()-session.Values["validateAt"].(int64) <= 5*60 {
		session.Values["loggedIn"] = true
		session.Values["validateAt"] = time.Now().Unix()
		if err = session.Save(c.Request, c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"email":    login.Email,
			"loggedIn": true,
		})
		return
	}

	c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
}

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

	if session.Values["loggedIn"] == true && session.Values["email"] != "" {
		if err = session.Save(c.Request, c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"email":    session.Values["email"],
			"loggedIn": session.Values["loggedIn"],
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

	if session.Values["loggedIn"] == true && session.Values["email"] != "" {
		c.Set("subject", session.Values["email"])
		c.Next()
		return
	}

	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
}
