package server

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"

	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/pkg/pubsub"
	"github.com/llaoj/gcopy/pkg/utils/hash"
	"github.com/sirupsen/logrus"

	"github.com/gin-gonic/gin"
	"github.com/llaoj/gcopy/internal/clipboard"
	"github.com/llaoj/gcopy/internal/middleware"
)

type Server struct {
	cb  *clipboard.Clipboard
	log *logrus.Entry
	ps  *pubsub.PubSub

	mu sync.Mutex
}

var ContentFilePath string

func NewServer(log *logrus.Logger) (*Server, error) {
	s := &Server{
		cb: &clipboard.Clipboard{},
	}
	s.log = log.WithField("role", "server")

	userHomeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	ContentFilePath = userHomeDir
	switch os := runtime.GOOS; os {
	case "darwin", "linux":
		ContentFilePath += "/.gcopy/server/content"
	case "windows":
		ContentFilePath += "\\.gcopy\\server\\content"
	default:
		s.log.Fatal("unsupported os")
	}
	if err := os.MkdirAll(filepath.Dir(ContentFilePath), 0750); err != nil {
		return nil, err
	}

	s.ps = pubsub.NewPubSub()

	return s, nil
}

func (s *Server) Run(wg *sync.WaitGroup) {
	defer wg.Done()
	cfg := config.Get()

	if cfg.Debug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()
	v1 := router.Group("/apis/v1").Use(middleware.Auth())
	{
		v1.GET("/clipboard", s.getClipboardHandler)
		v1.POST("/clipboard", s.updateClipboardHandler)
	}

	server := cfg.Listen
	addr := strings.Split(server, ":")
	if addr[0] == "" {
		ip, err := getOutboundIP()
		if err != nil {
			s.log.Fatal(err)
		}
		server = ip.String() + server
	}

	fmt.Printf("\nThe Server has started, start the clients:\n")
	fmt.Printf("/path/to/gcopy --role=client --server=%v --token=%v\n\n", server, cfg.Token)

	if err := router.Run(cfg.Listen); err != nil {
		s.log.Fatal(err)
	}
}

func (s *Server) updateClipboardHandler(c *gin.Context) {
	contentType := c.GetHeader("X-Content-Type")
	copiedFileName := c.GetHeader("X-Copied-File-Name")
	if contentType == "" || (contentType == clipboard.ContentTypeFile && copiedFileName == "") {
		c.String(http.StatusBadRequest, "invalid argument")
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// save the uploaded file
	file, err := c.FormFile("f")
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	c.SaveUploadedFile(file, ContentFilePath)

	contentHash, err := hash.HashFile(ContentFilePath)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	if contentHash == s.cb.ContentHash {
		c.String(http.StatusOK, "duplicate content")
		return
	}

	new := clipboard.Clipboard{
		Index:           s.cb.Index + 1,
		ContentHash:     contentHash,
		ContentType:     contentType,
		ContentFilePath: ContentFilePath,
		CopiedFileName:  copiedFileName,
	}
	s.cb = &new

	c.Header("X-Index", fmt.Sprintf("%v", s.cb.Index))
	c.String(http.StatusOK, fmt.Sprintf("clipboard uploaded: %+v", s.cb))

	s.ps.Publish()
}

func (s *Server) getClipboardHandler(c *gin.Context) {
	index, _ := strconv.Atoi(c.Query("index"))
	s.log.Debugf("get server clipboard, query index: %v, clipboard: %+v", index, s.cb)

	ch, close := s.ps.Subscribe()
	defer close()

	if s.cb.Index > 0 && index != s.cb.Index {
		s.responseClipboard(c)
		return
	}

	select {
	case <-ch:
		s.responseClipboard(c)
		return
	case <-c.Request.Context().Done():
		c.String(http.StatusRequestTimeout, "timeout")
		return
	}
}

func (s *Server) responseClipboard(c *gin.Context) {
	c.Header("X-Index", fmt.Sprintf("%v", s.cb.Index))
	c.Header("X-Content-Type", s.cb.ContentType)
	c.Header("X-Copied-File-Name", s.cb.CopiedFileName)
	c.FileAttachment(s.cb.ContentFilePath, filepath.Base(s.cb.ContentFilePath))
}

// get preferred outbound ip of this machine
func getOutboundIP() (net.IP, error) {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP, nil
}
