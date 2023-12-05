package config

import (
	"crypto/sha256"
	"flag"
	"fmt"
	"log"
	"net"
	"strings"
	"time"
)

func Get() *Config {
	if cfg != nil {
		return cfg
	}

	role := flag.String("role", "client", "Include: server/client/server,client")
	listen := flag.String("listen", ":3375", "The server will listen this ip and port, format: [ip]:port")
	server := flag.String("server", "", "The server addr, eg. https://example.com")
	tls := flag.Bool("tls", false, "Enable TLS")
	certFile := flag.String("certFile", "", "The certificate for the server, required if tls enable.")
	keyFile := flag.String("keyFile", "", "The private key for the server, required if tls enable.")
	insecureSkipVerify := flag.Bool("insecureSkipVerify", false, "Whether a client verifies the server's certificate chain and host name.")
	username := flag.String("username", "", "Basic authentication username")
	password := flag.String("password", "", "Basic authentication password")
	debug := flag.Bool("debug", false, "Enable debug mode")
	flag.Parse()

	if *tls && (*certFile == "" || *keyFile == "") {
		log.Fatal("certFile & keyFile cannot be empty")
	}
	if *server == "" {
		if ip, err := getOutboundIP(); err == nil {
			if addr := strings.Split(*listen, ":"); len(addr) == 2 {
				if *tls {
					*server = "https://"
				} else {
					*server = "http://"
				}
				*server += ip.String() + ":" + addr[1]
			}
		}
	}
	if *username == "" {
		*username = "u" + randstr(5)
	}
	if *password == "" {
		*password = randstr(6)
	}

	cfg = &Config{
		Role:               strings.ToLower(*role),
		Listen:             *listen,
		Server:             *server,
		TLS:                *tls,
		CertFile:           *certFile,
		KeyFile:            *keyFile,
		InsecureSkipVerify: *insecureSkipVerify,
		Username:           *username,
		Password:           *password,
		Debug:              *debug,
	}
	return cfg
}

// get preferred outbound ip of this machine
func getOutboundIP() (net.IP, error) {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP, nil
}

func randstr(len int) string {
	h := sha256.New()
	h.Write([]byte(time.Now().String()))
	token := fmt.Sprintf("%x", h.Sum(nil))
	return token[:len]
}
