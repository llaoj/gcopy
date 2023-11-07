package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/llaoj/gcopy/internal/config"
)

func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		if token == "" || token != config.Get().Token {
			c.String(http.StatusForbidden, "authorization failed")
			c.Abort()
			return
		}

		c.Next()
	}
}
