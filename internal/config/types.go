package config

var cfg *Config

type Config struct {
	Role               string
	Listen             string
	Server             string
	TLS                bool
	CertFile           string
	KeyFile            string
	InsecureSkipVerify bool
	Username           string
	Password           string
	Debug              bool
}
