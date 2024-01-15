package server

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type UserInfo struct {
	Email      string `json:"email"`
	IsLoggedIn bool   `json:"isLoggedIn"`
}

func (s *Server) verifyAuth(c *gin.Context) {
	cookie := c.Request.Header.Get("Cookie")

	request, err := http.NewRequest("GET", "http://gcopy-frontend:3375/api/session", nil)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
		return
	}
	request.Header.Set("Cookie", cookie)
	client := http.Client{
		Timeout: 10 * time.Second,
	}
	response, err := client.Do(request)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
		return
	}

	if response.StatusCode != http.StatusOK {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}

	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
		return
	}

	var userInfo UserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
		return
	}

	if !userInfo.IsLoggedIn || userInfo.Email == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}

	c.Set("subject", userInfo.Email)
	c.Next()
}
