package config

import (
	"errors"
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

func (c *Config) Validate() error {
	if c.AppKey == "" {
		return errors.New("app-key cannot be empty")
	}
	if len(c.AppKey) < 16 {
		return errors.New("app-key must be at least 16 characters")
	}
	if c.MaxContentLength <= 0 {
		return errors.New("max-content-length must be positive")
	}
	if c.MaxMemory < 0 {
		return errors.New("max-memory cannot be negative")
	}
	if c.MaxMemory > 0 && c.MaxMemory < c.MaxContentLength {
		return errors.New("max-memory must be greater than or equal to max-content-length (or 0 for unlimited)")
	}
	return nil
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

	maxContentLength := flag.Int("max-content-length", EnvOr("max-content-length", 10), "The max synchronized content length, unit: MiB.")
	maxMemory := flag.Int("max-memory", EnvOr("max-memory", 512), "Total memory cap for in-memory clipboards (LRU eviction), unit: MiB (0 = unlimited).")

	flag.Parse()

	if *flagVersion {
		version.PrintVersion()
		return nil
	}

	candidate := &Config{
		Debug:            *debug,
		AppKey:           *appKey,
		Listen:           *listen,
		TLSCertFile:      *tlsCertFile,
		TLSKeyFile:       *tlsKeyFile,
		MaxContentLength: *maxContentLength,
		MaxMemory:        *maxMemory,
	}
	if err := candidate.Validate(); err != nil {
		log.Fatal(err)
	}

	cfg = candidate
	return cfg
}
