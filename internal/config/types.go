package config

var cfg *Config

type Config struct {
	Debug        bool
	AppKey       string
	Listen       string
	TLS          bool
	TLSCertFile  string
	TLSKeyFile   string
	SMTPHost     string
	SMTPPort     int
	SMTPSSL      bool
	SMTPUsername string
	SMTPPassword string
	SMTPSender   string
}
