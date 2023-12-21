package config

import (
	"flag"
	"log"
)

func Get() *Config {
	if cfg != nil {
		return cfg
	}

	listen := flag.String("listen", ":3375", "The server will listen this ip and port, format: [ip]:port")
	tls := flag.Bool("tls", false, "Enable TLS")
	certFile := flag.String("certFile", "", "The certificate for the server, required if tls enable.")
	keyFile := flag.String("keyFile", "", "The private key for the server, required if tls enable.")
	clerkSecretKey := flag.String("clerkSecretKey", "", "The clerk secret key for use authentication.")
	debug := flag.Bool("debug", false, "Enable debug mode")
	flag.Parse()

	if *tls && (*certFile == "" || *keyFile == "") {
		log.Fatal("certFile & keyFile cannot be empty")
	}
	if *clerkSecretKey == "" {
		log.Fatal("you must provide an clerkSecretKey")
	}

	cfg = &Config{
		Listen:         *listen,
		TLS:            *tls,
		CertFile:       *certFile,
		KeyFile:        *keyFile,
		ClerkSecretKey: *clerkSecretKey,
		Debug:          *debug,
	}
	return cfg
}
