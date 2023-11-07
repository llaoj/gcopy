package config

import (
	"crypto/sha256"
	"flag"
	"fmt"
	"strings"
	"time"
)

func Get() *Config {
	if cfg != nil {
		return cfg
	}

	role := flag.String("role", "client", "Include: server/client/server,client")
	listen := flag.String("listen", ":3375", "The server will listen this ip and port, format: [ip]:port")
	server := flag.String("server", "127.0.0.1:3375", "The client will communicate with the server through this ip and port")
	token := flag.String("token", "", "Identity authentication between client and server")
	debug := flag.Bool("debug", false, "Enable debug mode")

	if *token == "" {
		*token = newToken()[:6]
	}
	flag.Parse()

	cfg = &Config{
		Role:   strings.ToLower(*role),
		Listen: *listen,
		Server: *server,
		Token:  *token,
		Debug:  *debug,
	}
	return cfg
}

func newToken() string {
	h := sha256.New()
	h.Write([]byte(time.Now().String()))
	token := fmt.Sprintf("%x", h.Sum(nil))
	return token
}
