package server

import (
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/llaoj/gcopy/internal/server/auth"
	"github.com/llaoj/gcopy/internal/static"
	"github.com/llaoj/gcopy/pkg/utils"
	"github.com/mileusna/useragent"
	"github.com/sirupsen/logrus"
)

type Server struct {
	wall         *Wall
	config       *config.Config
	log          *logrus.Logger
	sessionStore sessions.Store
	authProvider auth.AuthProvider
}

func NewServer(log *logrus.Logger) *Server {
	cfg := config.Get()
	sessionStore := sessions.NewCookieStore([]byte(cfg.AppKey))

	var provider auth.AuthProvider
	if cfg.AuthMode == "email" {
		provider = auth.NewEmailAuthProvider(cfg, sessionStore)
	} else if cfg.AuthMode == "token" {
		provider = auth.NewTokenAuthProvider(cfg, sessionStore)
	}

	s := &Server{
		wall:         NewWall(log),
		config:       cfg,
		log:          log,
		sessionStore: sessionStore,
		authProvider: provider,
	}

	return s
}

func (s *Server) Run() {
	stop := s.wall.Housekeeping()
	defer stop()

	if s.config.Debug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })
	r.HEAD("/ping", func(c *gin.Context) { c.String(200, "pong") })

	v1 := r.Group("/api/v1")
	v1.GET("/systeminfo", s.getSystemInfoHandler)

	// Register auth routes
	s.authProvider.RegisterRoutes(v1)

	v1.GET("/user/logout", s.logoutHandler)
	v1.GET("/user", s.getUserHandler)

	v1.Use(s.verifyAuthMiddleware)
	v1.GET("/clipboard", s.getClipboardHandler)
	v1.POST("/clipboard", s.updateClipboardHandler)

	// Static files from embedded frontend
	assetFS := static.AssetFS()
	r.Use(s.cacheMiddleware())
	r.NoRoute(s.frontendHandler(assetFS))

	s.log.Info("The server has started!")
	var err error
	if s.config.TLSCertFile != "" && s.config.TLSKeyFile != "" {
		err = r.RunTLS(s.config.Listen, s.config.TLSCertFile, s.config.TLSKeyFile)
	} else {
		err = r.Run(s.config.Listen)
	}
	if err != nil {
		s.log.Fatal(err)
	}
}

func (s *Server) getClipboardHandler(c *gin.Context) {
	subject, ok := c.Get("subject")
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "Subject not found"})
		return
	}
	sub, ok := subject.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Subject type assert failed"})
		return
	}
	cb := s.wall.Get(sub)
	if cb == nil {
		c.Header("X-Index", "0")
		c.Status(http.StatusOK)
		return
	}
	index, _ := strconv.Atoi(c.Request.Header.Get("X-Index"))
	if index == cb.Index {
		c.Header("X-Index", strconv.Itoa(cb.Index))
		c.Status(http.StatusOK)
		return
	}

	c.Status(http.StatusOK)
	c.Header("Content-Type", cb.MIMEType)
	c.Header("Content-Length", strconv.Itoa(len(cb.Data)))
	c.Header("X-Index", strconv.Itoa(cb.Index))
	c.Header("X-Type", cb.Type)
	c.Header("X-FileName", cb.FileName)
	c.Header("X-ClientName", cb.ClientName)
	// 强制浏览器下载文件而不是渲染，对 iOS Safari 特别重要
	if cb.Type == gcopy.TypeFile {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", cb.FileName))
	}
	if _, err := c.Writer.Write(cb.Data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Write data failed"})
		s.log.Error(err)
	}
}

func (s *Server) updateClipboardHandler(c *gin.Context) {
	subject, ok := c.Get("subject")
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "Subject not found"})
		return
	}
	sub, ok := subject.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Subject type assert failed"})
		return
	}

	// 限制请求体大小
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, int64(s.config.MaxContentLength)*1024*1024)

	contentLength, err := strconv.Atoi(c.Request.Header.Get("Content-Length"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if contentLength > s.config.MaxContentLength*1024*1024 {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"message": fmt.Sprintf("The synchronized content length cannot exceed %vMiB", s.config.MaxContentLength)})
		return
	}

	data, err := io.ReadAll(c.Request.Body)
	if err != nil {
		s.log.Errorf("Failed to read request body: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": fmt.Sprintf("Failed to read request body: %v", err)})
		return
	}
	defer c.Request.Body.Close()
	if data == nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Request body is nil"})
		return
	}

	xType := c.Request.Header.Get("X-Type")
	xFileName := c.Request.Header.Get("X-FileName")
	if xType == "" || (xType == gcopy.TypeFile && xFileName == "") {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Request header invalid"})
		return
	}

	cb := s.wall.Get(sub)
	index := 0
	if cb != nil {
		index = cb.Index
	}

	var clientName string
	ua := useragent.Parse(c.Request.Header.Get("User-Agent"))
	if ua.OS != "" {
		clientName = ua.OS
		if ua.Name != "" {
			clientName += fmt.Sprintf(" %s", ua.Name)
		}
	}

	cb = &gcopy.Clipboard{
		Index:      index + 1,
		Type:       xType,
		FileName:   xFileName,
		Data:       data,
		CreatedAt:  time.Now(),
		ClientName: clientName,
		MIMEType:   c.Request.Header.Get("Content-Type"),
	}
	s.log.Infof("[%s] Received %s(%v)", utils.StrMaskMiddle(sub), cb.Type, cb.Index)
	s.wall.Set(sub, cb)

	c.Header("X-Index", strconv.Itoa(cb.Index))
	c.JSON(http.StatusOK, gin.H{"message": "Success"})
}

func (s *Server) cacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/_next/static/") {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			c.Header("Cache-Control", "no-cache")
		}
		c.Next()
	}
}

func (s *Server) frontendHandler(assetFS fs.FS) gin.HandlerFunc {
	staticServer := http.FileServer(http.FS(assetFS))
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/" {
			data, err := fs.ReadFile(assetFS, "index.html")
			if err != nil {
				s.log.Errorf("Failed to read index.html: %v", err)
				c.Status(http.StatusNotFound)
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", data)
			return
		}
		f, err := assetFS.Open(strings.TrimPrefix(path, "/"))
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		f.Close()
		staticServer.ServeHTTP(c.Writer, c.Request)
	}
}
