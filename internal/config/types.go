package config

var cfg *Config

type Config struct {
	Listen   string
	TLS      bool
	CertFile string
	KeyFile  string
	Debug    bool
}
