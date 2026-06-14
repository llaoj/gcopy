package config

import (
	"flag"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/llaoj/gcopy/pkg/version"
)

// EnvOr returns the environment variable value for the given flag name,
// using the GCOPY_ prefix and converting dashes to underscores (e.g. "app-key" → "GCOPY_APP_KEY").
// Returns the fallback if the environment variable is not set or cannot be parsed.
func EnvOr[T any](name string, fallback T) T {
	key := "GCOPY_" + strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
	v, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	switch any(fallback).(type) {
	case string:
		return any(v).(T)
	case bool:
		b, err := strconv.ParseBool(v)
		if err != nil {
			log.Printf("warning: invalid bool value %q for %s, using default", v, key)
			return fallback
		}
		return any(b).(T)
	case int:
		i, err := strconv.Atoi(v)
		if err != nil {
			log.Printf("warning: invalid int value %q for %s, using default", v, key)
			return fallback
		}
		return any(i).(T)
	default:
		return fallback
	}
}

func Get() *Config {
	if cfg != nil {
		return cfg
	}

	flagVersion := flag.Bool("version", false, "Print version")
	debug := flag.Bool("debug", EnvOr("debug", false), "Enable debug mode")
	appKey := flag.String("app-key", EnvOr("app-key", ""), "Encryption Key")

	listen := flag.String("listen", EnvOr("listen", ":3375"), "The server will listen this ip and port, format: [ip]:port")
	tlsCertFile := flag.String("tls-cert-file", EnvOr("tls-cert-file", ""), "Path to TLS certificate file")
	tlsKeyFile := flag.String("tls-key-file", EnvOr("tls-key-file", ""), "Path to TLS key file")

	smtpHost := flag.String("smtp-host", EnvOr("smtp-host", ""), "Represents the host of the SMTP server.")
	smtpPort := flag.Int("smtp-port", EnvOr("smtp-port", 587), "Represents the port of the SMTP server.")
	smtpSSL := flag.Bool("smtp-ssl", EnvOr("smtp-ssl", false), "Whether an SSL connection is used. It should be false in most cases since the authentication mechanism should use the STARTTLS extension instead.")
	smtpUsername := flag.String("smtp-username", EnvOr("smtp-username", ""), "The username to use to authenticate to the SMTP server.")
	smtpPassword := flag.String("smtp-password", EnvOr("smtp-password", ""), "The password to use to authenticate to the SMTP server.")
	smtpSender := flag.String("smtp-sender", EnvOr("smtp-sender", ""), "The Sender of the email, if the field is not given, the username will be used.")

	maxContentLength := flag.Int("max-content-length", EnvOr("max-content-length", 10), "The max synchronized content length, unit: MiB.")
	authMode := flag.String("auth-mode", EnvOr("auth-mode", "email"), "Authentication mode: email or token")

	flag.Parse()

	if *flagVersion {
		version.PrintVersion()
		return nil
	}
	if *appKey == "" {
		log.Fatal("app-key cannot be empty")
	}
	if len(*appKey) < 8 {
		log.Fatal("app-key must be at least 8 characters")
	}

	// Validate auth-mode
	if *authMode != "email" && *authMode != "token" {
		log.Fatal("auth-mode must be: email or token")
	}

	// SMTP is required for email auth mode
	if *authMode == "email" {
		if *smtpHost == "" || *smtpUsername == "" || *smtpPassword == "" {
			log.Fatal("smtp-host & smtp-username & smtp-password are required for email auth mode")
		}
	}
	if *smtpSender == "" {
		*smtpSender = *smtpUsername
	}

	cfg = &Config{
		Debug:            *debug,
		AppKey:           *appKey,
		Listen:           *listen,
		TLSCertFile:      *tlsCertFile,
		TLSKeyFile:       *tlsKeyFile,
		SMTPHost:         *smtpHost,
		SMTPPort:         *smtpPort,
		SMTPSSL:          *smtpSSL,
		SMTPUsername:     *smtpUsername,
		SMTPPassword:     *smtpPassword,
		SMTPSender:       *smtpSender,
		MaxContentLength: *maxContentLength,
		AuthMode:         *authMode,
	}
	return cfg
}
