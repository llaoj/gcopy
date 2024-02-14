package config

var cfg *Config

type Config struct {
	Listen      string
	FrontendURL string
	TLS         bool
	CertFile    string
	KeyFile     string
	Debug       bool
}
