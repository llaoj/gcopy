package config

import (
	"flag"
	"log"
)

func Get() *Config {
	if cfg != nil {
		return cfg
	}

	listen := flag.String("listen", ":3376", "The server will listen this ip and port, format: [ip]:port")
	frontendURL := flag.String("frontendURL", "http://gcopy-frontend:3375", "Web client url")
	tls := flag.Bool("tls", false, "Enable TLS")
	certFile := flag.String("certFile", "", "The certificate for the server, required if tls enable.")
	keyFile := flag.String("keyFile", "", "The private key for the server, required if tls enable.")
	debug := flag.Bool("debug", false, "Enable debug mode")
	flag.Parse()

	if *tls && (*certFile == "" || *keyFile == "") {
		log.Fatal("certFile & keyFile cannot be empty")
	}

	cfg = &Config{
		Listen:      *listen,
		FrontendURL: *frontendURL,
		TLS:         *tls,
		CertFile:    *certFile,
		KeyFile:     *keyFile,
		Debug:       *debug,
	}
	return cfg
}
