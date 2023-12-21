package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func (s *Server) getSystemInfoHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"time": time.Now(),
	})
}
