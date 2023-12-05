package server

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/llaoj/gcopy/internal/config"
	"github.com/llaoj/gcopy/internal/gcopy"
	"github.com/sirupsen/logrus"
)

type Server struct {
	cb *gcopy.Clipboard

	log *logrus.Entry
}

func NewServer(log *logrus.Logger) *Server {
	return &Server{
		cb:  &gcopy.Clipboard{},
		log: log.WithField("role", "server"),
	}
}

func (s *Server) Run(wg *sync.WaitGroup) {
	defer wg.Done()
	cfg := config.Get()
	if err := printClientCommand(); err != nil {
		s.log.Fatal()
	}

	if cfg.Debug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.BasicAuth(gin.Accounts{cfg.Username: cfg.Password}))

	r.GET("/ping", func(c *gin.Context) { c.String(200, "pong") })
	r.GET("/clipboard", s.getClipboardHandler)
	r.POST("/clipboard", s.updateClipboardHandler)
	r.LoadHTMLGlob("internal/server/templates/*")
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.tmpl", gin.H{
			"title": "GCopy Web Client",
		})
	})
	if cfg.TLS {
		r.RunTLS(cfg.Listen, cfg.CertFile, cfg.KeyFile)
	} else {
		r.Run(cfg.Listen)
	}
}

func printClientCommand() error {
	cfg := config.Get()
	server := cfg.Server
	fmt.Printf("\nThe Server has started!\n")
	fmt.Printf("Start command cli: /path/to/gcopy --role=client --server=%v --username=%v --password=%v\n",
		server,
		cfg.Username,
		cfg.Password,
	)
	fmt.Printf("Visit web cli: %v/\n\n", server)

	return nil
}

func (s *Server) getClipboardHandler(c *gin.Context) {
	index, _ := strconv.Atoi(c.Request.Header.Get("X-Index"))
	c.Header("X-Index", strconv.Itoa(s.cb.Index))
	c.Status(http.StatusOK)
	if s.cb.Index == 0 || index == s.cb.Index {
		return
	}
	c.Header("X-Type", s.cb.Type)
	c.Header("X-FileName", url.QueryEscape(s.cb.FileName))
	if _, err := c.Writer.Write(s.cb.Data); err != nil {
		s.log.Error(err)
	}
}

func (s *Server) updateClipboardHandler(c *gin.Context) {
	data, err := io.ReadAll(c.Request.Body)
	if err != nil {
		s.log.Error(err)
	}
	defer c.Request.Body.Close()
	if data == nil {
		c.Status(http.StatusBadRequest)
		return
	}

	xType := c.Request.Header.Get("X-Type")
	xFileName := c.Request.Header.Get("X-FileName")
	if xType == "" || (xType == gcopy.TypeFile && xFileName == "") {
		c.Status(http.StatusBadRequest)
		return
	}

	s.cb = &gcopy.Clipboard{
		Index:    s.cb.Index + 1,
		Type:     xType,
		FileName: xFileName,
		Data:     data,
	}
	s.log.Infof("received %s(%v)", s.cb.Type, s.cb.Index)
	c.Status(http.StatusOK)
	c.Header("X-Index", strconv.Itoa(s.cb.Index))
}
