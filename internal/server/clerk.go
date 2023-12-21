package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *Server) verifyClerkToken(c *gin.Context) {
	token := c.Request.Header.Get("Authorization")
	claims, err := s.clerk.VerifyToken(strings.TrimPrefix(token, "Bearer "))
	if err != nil {
		c.String(http.StatusUnauthorized, err.Error())
		return
	}

	c.Set("subject", claims.Claims.Subject)
	c.Next()
}
