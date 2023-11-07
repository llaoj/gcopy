package config

var cfg *Config

type Config struct {
	Role   string
	Listen string
	Server string
	Token  string
	Debug  bool
}
