package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/gcopy"
	applog "github.com/llaoj/gcopy/internal/log"
	"github.com/llaoj/gcopy/internal/server/auth"
	"github.com/llaoj/gcopy/internal/static"
	"github.com/mileusna/useragent"
	"github.com/sirupsen/logrus"
)

type Server struct {
	wall         *Wall
	notifier     *Notifier
	config       *config.Config
	log          *applog.Logger
	sessionStore sessions.Store
	tokenAuth    *auth.TokenAuth
	// clipboardMu serializes the read-modify-write of the clipboard index.
	// A single global mutex is enough here: the critical section is tiny and
	// uploads are infrequent.
	clipboardMu sync.Mutex
}

func NewServer(baseLog *logrus.Logger) *Server {
	cfg := config.Get()
	sessionStore := sessions.NewCookieStore([]byte(cfg.AppKey))
	sessionStore.Options.HttpOnly = true
	sessionStore.Options.SameSite = http.SameSiteLaxMode
	// GCopy requires HTTPS (the browser Clipboard API needs a secure context),
	// so the session cookie is always Secure.
	sessionStore.Options.Secure = true

	tokenAuth := auth.NewTokenAuth(sessionStore)
	appLogger := applog.New(baseLog, cfg.AppKey)
	maxBytes := int64(cfg.MaxMemory) * 1024 * 1024

	s := &Server{
		wall:         NewWall(appLogger, maxBytes),
		notifier:     NewNotifier(),
		config:       cfg,
		log:          appLogger,
		sessionStore: sessionStore,
		tokenAuth:    tokenAuth,
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
	// GCopy does not interpret proxy headers (client IP / forwarding is handled
	// at the edge). Disabling trusted proxies also silences Gin's warning about
	// trusting all proxies by default.
	if err := r.SetTrustedProxies(nil); err != nil {
		s.log.Warnf("Failed to configure trusted proxies: %v", err)
	}
	r.Use(s.securityHeadersMiddleware())

	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })
	r.HEAD("/ping", func(c *gin.Context) { c.String(200, "pong") })

	v1 := r.Group("/api/v1")
	v1.GET("/systeminfo", s.getSystemInfoHandler)

	// Register auth routes
	s.tokenAuth.RegisterRoutes(v1)

	v1.GET("/user/logout", s.logoutHandler)
	v1.GET("/user", s.getUserHandler)

	v1.Use(s.verifyAuthMiddleware)
	v1.GET("/clipboard", s.getClipboardHandler)
	v1.GET("/clipboard/events", s.getClipboardEventsHandler)
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
	userID, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	clipboard := s.wall.Get(userID)
	if clipboard == nil {
		c.Header(gcopy.HeaderIndex, "0")
		c.Status(http.StatusOK)
		return
	}
	index, _ := strconv.Atoi(c.Request.Header.Get(gcopy.HeaderIndex))
	if index == clipboard.Index {
		c.Header(gcopy.HeaderIndex, strconv.Itoa(clipboard.Index))
		c.Status(http.StatusOK)
		return
	}

	c.Status(http.StatusOK)
	c.Header("Content-Type", clipboard.MIMEType)
	c.Header("Content-Length", strconv.Itoa(len(clipboard.Data)))
	c.Header(gcopy.HeaderIndex, strconv.Itoa(clipboard.Index))
	c.Header(gcopy.HeaderType, clipboard.Type)
	c.Header(gcopy.HeaderFileName, clipboard.FileName)
	c.Header(gcopy.HeaderClientName, clipboard.ClientName)
	// 强制浏览器下载文件而不是渲染，对 iOS Safari 特别重要
	if clipboard.Type == gcopy.TypeFile {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", clipboard.FileName))
	}
	if _, err := c.Writer.Write(clipboard.Data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Write data failed"})
		s.log.Error(err)
		return
	}

	s.log.Analytics("sync_download", userID, logrus.Fields{
		"type":  clipboard.Type,
		"index": clipboard.Index,
	})
}

func (s *Server) currentClipboardEvent(userID string) ClipboardEvent {
	clipboard := s.wall.Get(userID)
	if clipboard == nil {
		return ClipboardEvent{Index: 0}
	}
	return ClipboardEvent{
		Index:      clipboard.Index,
		Type:       clipboard.Type,
		ClientName: clipboard.ClientName,
	}
}

const sseHeartbeatInterval = 25 * time.Second

func writeClipboardEvent(w http.ResponseWriter, event ClipboardEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "data: %s\n\n", payload)
	return err
}

func (s *Server) getClipboardEventsHandler(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	if s.notifier == nil {
		c.Status(http.StatusServiceUnavailable)
		return
	}

	listener, unsubscribe, ok := s.notifier.Subscribe(userID)
	if !ok {
		c.JSON(http.StatusTooManyRequests, gin.H{"message": "Too many open event streams"})
		return
	}
	defer unsubscribe()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-store")
	c.Header("Connection", "keep-alive")
	// Disable proxy response buffering (e.g. Nginx) so events flush immediately.
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)

	// Push initial event immediately so the client gets current state on connect.
	if err := writeClipboardEvent(c.Writer, s.currentClipboardEvent(userID)); err != nil {
		return
	}
	c.Writer.Flush()

	heartbeat := time.NewTicker(sseHeartbeatInterval)
	defer heartbeat.Stop()

	ctx := c.Request.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case event := <-listener:
			if err := writeClipboardEvent(c.Writer, event); err != nil {
				return
			}
			c.Writer.Flush()
		case <-heartbeat.C:
			if _, err := fmt.Fprint(c.Writer, ": ping\n\n"); err != nil {
				return
			}
			c.Writer.Flush()
		}
	}
}

func (s *Server) updateClipboardHandler(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}

	// 限制请求体大小：按实际读取的字节数封顶，不依赖客户端的 Content-Length
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, int64(s.config.MaxContentLength)*1024*1024)

	data, err := io.ReadAll(c.Request.Body)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"message": fmt.Sprintf("The synchronized content length cannot exceed %vMiB", s.config.MaxContentLength)})
			return
		}
		s.log.Errorf("Failed to read request body: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": fmt.Sprintf("Failed to read request body: %v", err)})
		return
	}
	if data == nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Request body is nil"})
		return
	}

	clipboardType := c.Request.Header.Get(gcopy.HeaderType)
	fileName := c.Request.Header.Get(gcopy.HeaderFileName)
	mimeType := c.Request.Header.Get("Content-Type")

	// Infer X-Type when omitted so simple curl / Shortcuts requests don't have
	// to pass extra headers for common text, image, or named-file uploads.
	if clipboardType == "" {
		switch {
		case fileName != "":
			clipboardType = gcopy.TypeFile
		case strings.HasPrefix(mimeType, "image/"):
			clipboardType = gcopy.TypeScreenshot
		default:
			clipboardType = gcopy.TypeText
		}
	}

	switch clipboardType {
	case gcopy.TypeText:
		if mimeType == "" || strings.HasPrefix(mimeType, "application/x-www-form-urlencoded") {
			mimeType = "text/plain; charset=utf-8"
		}
	case gcopy.TypeScreenshot:
		if mimeType == "" || strings.HasPrefix(mimeType, "application/x-www-form-urlencoded") {
			mimeType = "image/png"
		}
	case gcopy.TypeFile:
		if fileName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Request header invalid"})
			return
		}
		if mimeType == "" || strings.HasPrefix(mimeType, "application/x-www-form-urlencoded") {
			mimeType = "application/octet-stream"
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"message": "Request header invalid"})
		return
	}

	clientName := parseClientName(c.Request.Header.Get("User-Agent"))

	// Serialize the read-modify-write of the clipboard index so concurrent
	// uploads don't collide on the same index.
	s.clipboardMu.Lock()
	index := 0
	if prev := s.wall.Get(userID); prev != nil {
		index = prev.Index
	}
	clipboard := &gcopy.Clipboard{
		Index:      index + 1,
		Type:       clipboardType,
		FileName:   fileName,
		Data:       data,
		CreatedAt:  time.Now(),
		ClientName: clientName,
		MIMEType:   mimeType,
	}
	s.wall.Set(userID, clipboard)
	s.clipboardMu.Unlock()

	if s.notifier != nil {
		s.notifier.Notify(userID, ClipboardEvent{
			Index:      clipboard.Index,
			Type:       clipboard.Type,
			ClientName: clipboard.ClientName,
		})
	}

	s.log.Analytics("sync_upload", userID, logrus.Fields{
		"type":  clipboard.Type,
		"index": clipboard.Index,
	})

	c.Header(gcopy.HeaderIndex, strconv.Itoa(clipboard.Index))
	c.JSON(http.StatusOK, gin.H{"message": "Success"})
}

func parseClientName(rawUA string) string {
	ua := useragent.Parse(rawUA)
	if ua.OS != "" {
		if ua.Name != "" {
			return fmt.Sprintf("%s %s", ua.OS, ua.Name)
		}
		return ua.OS
	}
	// Fallback for CLI / automation clients (e.g. "curl/8.7.1" -> "curl").
	product := strings.TrimSpace(rawUA)
	if idx := strings.IndexAny(product, "/ "); idx > 0 {
		product = product[:idx]
	}
	if len(product) > 32 {
		product = product[:32]
	}
	return product
}

func (s *Server) securityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		// Only advertise HSTS when the request actually arrived over HTTPS.
		if c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https") {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
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
		// fs.FS 的路径是非法时（如带尾部斜杠的 "user/token/"），embed.FS 会
		// 直接返回错误。Next 的 trailingSlash 导出形式是 "user/token/index.html"，
		// 所以这里先去掉尾部斜杠再判断文件是否存在，目录交给 FileServer 处理。
		name := strings.Trim(strings.TrimPrefix(path, "/"), "/")
		if _, err := fs.Stat(assetFS, name); err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		staticServer.ServeHTTP(c.Writer, c.Request)
	}
}
