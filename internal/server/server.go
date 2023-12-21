package server

import (
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/clerkinc/clerk-sdk-go/clerk"
	"github.com/gin-gonic/gin"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/sirupsen/logrus"
)

type Server struct {
	cb map[string]*gcopy.Clipboard

	log *logrus.Logger
}

func NewServer(log *logrus.Logger) *Server {
	return &Server{
		cb:  make(map[string]*gcopy.Clipboard),
		log: log,
	}
}

func (s *Server) Run() {
	cfg := config.Get()

	if cfg.Debug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())

	clerkClient, err := clerk.NewClient(cfg.ClerkSecretKey)
	if err != nil {
		s.log.Fatal(err)
	}

	// use clerk
	r.Use(func(c *gin.Context) {
		token := c.Request.Header.Get("Authorization")
		token = strings.TrimPrefix(token, "Bearer ")

		claims, err := clerkClient.VerifyToken(token)
		if err != nil {
			c.String(http.StatusUnauthorized, "Unauthorized")
			return
		}
		c.Set("subject", claims.Claims.Subject)
		c.Next()
	})

	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })

	r.GET("/clipboard", s.getClipboardHandler)
	r.POST("/clipboard", s.updateClipboardHandler)
	s.log.Info("The server has started!")
	if cfg.TLS {
		r.RunTLS(cfg.Listen, cfg.CertFile, cfg.KeyFile)
	} else {
		r.Run(cfg.Listen)
	}
}

func (s *Server) getClipboardHandler(c *gin.Context) {
	subject, ok := c.Get("subject")
	if !ok {
		c.String(http.StatusNotFound, "Subject not found")
		return
	}
	sub, ok := subject.(string)
	if !ok {
		c.String(http.StatusInternalServerError, "Subject type assert failed")
		return
	}
	cb := s.cb[sub]

	index, _ := strconv.Atoi(c.Request.Header.Get("X-Index"))
	c.Header("X-Index", strconv.Itoa(cb.Index))
	c.Status(http.StatusOK)
	if cb.Index == 0 || index == cb.Index {
		return
	}
	c.Header("X-Type", cb.Type)
	c.Header("X-FileName", cb.FileName)
	if _, err := c.Writer.Write(cb.Data); err != nil {
		s.log.Error(err)
	}
}

func (s *Server) updateClipboardHandler(c *gin.Context) {
	subject, ok := c.Get("subject")
	if !ok {
		c.String(http.StatusNotFound, "Subject not found")
		return
	}
	sub, ok := subject.(string)
	if !ok {
		c.String(http.StatusInternalServerError, "Subject type assert failed")
		return
	}

	data, err := io.ReadAll(c.Request.Body)
	if err != nil {
		s.log.Error(err)
	}
	defer c.Request.Body.Close()
	if data == nil {
		c.String(http.StatusBadRequest, "Request body is nil")
		return
	}

	xType := c.Request.Header.Get("X-Type")
	xFileName := c.Request.Header.Get("X-FileName")
	if xType == "" || (xType == gcopy.TypeFile && xFileName == "") {
		c.String(http.StatusBadRequest, "Request header invalid")
		return
	}

	cb := s.cb[sub]
	cb = &gcopy.Clipboard{
		Index:    cb.Index + 1,
		Type:     xType,
		FileName: xFileName,
		Data:     data,
	}
	s.log.Infof("Received %s(%v)", cb.Type, cb.Index)
	s.cb[sub] = cb

	c.Header("X-Index", strconv.Itoa(cb.Index))
	c.String(http.StatusOK, "Success")
}
