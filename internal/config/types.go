package config

var cfg *Config

type Config struct {
	Debug            bool
	AppKey           string
	Listen           string
	SMTPHost         string
	SMTPPort         int
	SMTPSSL          bool
	SMTPUsername     string
	SMTPPassword     string
	SMTPSender       string
	MaxContentLength int
	AuthMode         string // "email" or "token"
}
