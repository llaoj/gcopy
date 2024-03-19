package config

import (
	"flag"
	"log"

	"github.com/llaoj/gcopy/pkg/version"
)

func Get() *Config {
	if cfg != nil {
		return cfg
	}

	flagVersion := flag.Bool("version", false, "Print version")
	debug := flag.Bool("debug", false, "Enable debug mode")
	appKey := flag.String("app-key", "", "Encryption Key")

	listen := flag.String("listen", ":3376", "The server will listen this ip and port, format: [ip]:port")
	tls := flag.Bool("tls", false, "Enable TLS")
	tlsCertFile := flag.String("tls-cert-file", "", "The certificate for the server, required if tls enable.")
	tlsKeyFile := flag.String("tls-key-file", "", "The private key for the server, required if tls enable.")

	smtpHost := flag.String("smtp-host", "", "Represents the host of the SMTP server.")
	smtpPort := flag.Int("smtp-port", 587, "Represents the port of the SMTP server.")
	smtpSSL := flag.Bool("smtp-ssl", false, "Whether an SSL connection is used. It should be false in most cases since the authentication mechanism should use the STARTTLS extension instead.")
	smtpUsername := flag.String("smtp-username", "", "The username to use to authenticate to the SMTP server.")
	smtpPassword := flag.String("smtp-password", "", "The password to use to authenticate to the SMTP server.")
	smtpSender := flag.String("smtp-sender", "", "The Sender of the email, if the field is not given, the username will be used.")

	maxContentLength := flag.Int("max-content-length", 10, "The max synchronized content length, unit: MiB.")

	flag.Parse()

	if *flagVersion {
		version.PrintVersion()
		return nil
	}
	if *appKey == "" {
		log.Fatal("app-key cannot be empty")
	}
	if *tls && (*tlsCertFile == "" || *tlsKeyFile == "") {
		log.Fatal("tls-cert-file & tls-key-file cannot be empty")
	}
	if *smtpHost == "" || *smtpUsername == "" || *smtpPassword == "" {
		log.Fatal("smtp-host & smtp-username & smtp-password cannot be empty")
	}
	if *smtpSender == "" {
		*smtpSender = *smtpUsername
	}

	cfg = &Config{
		Debug:            *debug,
		AppKey:           *appKey,
		Listen:           *listen,
		TLS:              *tls,
		TLSCertFile:      *tlsCertFile,
		TLSKeyFile:       *tlsKeyFile,
		SMTPHost:         *smtpHost,
		SMTPPort:         *smtpPort,
		SMTPSSL:          *smtpSSL,
		SMTPUsername:     *smtpUsername,
		SMTPPassword:     *smtpPassword,
		SMTPSender:       *smtpSender,
		MaxContentLength: *maxContentLength,
	}
	return cfg
}
