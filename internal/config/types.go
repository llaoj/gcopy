package config

var cfg *Config

type Config struct {
	Debug            bool
	AppKey           string
	Listen           string
	TLSCertFile      string
	TLSKeyFile       string
	MaxContentLength int
}
