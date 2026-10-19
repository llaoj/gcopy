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

	maxContentLength := flag.Int("max-content-length", EnvOr("max-content-length", 10), "The max synchronized content length, unit: MiB.")

	flag.Parse()

	if *flagVersion {
		version.PrintVersion()
		return nil
	}
	if *appKey == "" {
		log.Fatal("app-key cannot be empty")
	}
	if len(*appKey) < 16 {
		log.Fatal("app-key must be at least 16 characters")
	}

	cfg = &Config{
		Debug:            *debug,
		AppKey:           *appKey,
		Listen:           *listen,
		TLSCertFile:      *tlsCertFile,
		TLSKeyFile:       *tlsKeyFile,
		MaxContentLength: *maxContentLength,
	}
	return cfg
}
