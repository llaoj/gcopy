# How to deploy

## Behind a proxy

HTTPS is required. I recommend deploying it behind a proxy, eg. Nginx, Ingress Controller

You can refer to the Nginx configuration file: `deploy/nginx-example.conf`

## Standalone

Using docker compose:

1. Create docker-compose.yml file, modify the params `<var-name>`, refer: `deploy/docker-compose.yml` and the usage of gcopy-server command:

```sh
$ /gcopy --help
Usage of /gcopy:
  -app-key string
    	Secret used to encrypt and decrypt data, recommend using random strings over 8 characters.
  -debug
    	Enable debug mode
  -listen string
    	The server will listen this ip and port, format: [ip]:port (default ":3376")
  -max-content-length int
    	The max synchronized content length, unit: MiB. (default 10)
  -smtp-host string
    	Represents the host of the SMTP server.
  -smtp-password string
    	The password to use to authenticate to the SMTP server.
  -smtp-port int
    	Represents the port of the SMTP server. (default 587)
  -smtp-sender string
    	The Sender of the email, if the field is not given, the username will be used.
  -smtp-ssl
    	Whether an SSL connection is used. It should be false in most cases since the authentication mechanism should use the STARTTLS extension instead.
  -smtp-username string
    	The username to use to authenticate to the SMTP server.
  -tls
    	Enable TLS
  -tls-cert-file string
    	The certificate for the server, required if tls enable.
  -tls-key-file string
    	The private key for the server, required if tls enable.
  -version
    	Print version
```


2. Create configuration file of frontend, refer: `frontend/.env.sample`
3. Start the containers:

```sh
docker-compose up -d
```

## Kubernetes

You can refer to the configuration for a standalone and deploy GCopy into Kubernetes.