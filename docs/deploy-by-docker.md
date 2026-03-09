# Deploy by Docker
We have prepared the container image for you. Deploying directly using Docker is the most convenient option.

## Authentication Modes

GCopy supports two authentication modes:

### Email Authentication (Default)
Requires SMTP configuration for sending verification codes.

### Token Authentication
No SMTP required, simpler setup for trusted environments.

See [TOKEN_AUTH.md](TOKEN_AUTH.md) for detailed configuration and security considerations.

## Standalone
By leveraging the container orchestration capabilities of Docker Compose, we can deploy the frontend and backend services of gcopy.

### Create `docker-compose.yml`

Create directory and download `deploy/docker-compose.yml` to the directory, then modify the parameter `<var-name>` of `docker-compose.yml`.

```bash
# The directory location can be customized.
mkdir -p /opt/gcopy
wget -O /opt/gcopy/docker-compose.yml https://raw.githubusercontent.com/llaoj/gcopy/main/deploy/docker-compose.yml
```

### Configuration Examples

**Note:** GCopy uses command-line flags for configuration, not environment variables. Modify the `command` section in `docker-compose.yml`.

#### Email Authentication Mode (Default)

Edit `docker-compose.yml`:

```yaml
services:
  gcopy:
    command:
      - --app-key=your-secret-key-min-8-chars
      - --auth-mode=email
      - --smtp-host=smtp.example.com
      - --smtp-port=587
      - --smtp-username=your-email@example.com
      - --smtp-password=your-smtp-password
```

#### Token Authentication Mode

Edit `docker-compose.yml`:

```yaml
services:
  gcopy:
    command:
      - --app-key=your-secret-key-min-8-chars
      - --auth-mode=token
```

**Note:** Token mode does not require SMTP configuration, making it ideal for:
- Intranet/LAN environments
- Personal use
- Trusted team environments

Refer the usage of the gcopy:

```bash
$ gcopy --help
Usage of gcopy:
    -app-key string
        Secret used to encrypt and decrypt data, recommend using random strings over 8 characters.
    -auth-mode string
        Authentication mode: email or token (default "email")
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
    -smtp-ssl bool
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

### Create frontend configuration file
Download frontend configuration file to the frontend directory without any modifications needed.

```bash
mkdir -p /opt/gcopy/frontend
wget -O /opt/gcopy/frontend/.env.production https://raw.githubusercontent.com/llaoj/gcopy/main/frontend/.env.sample
```

### Start the containers

```sh
docker-compose up -d
```

## Behind a proxy

HTTPS is required. I recommend deploying it behind a proxy, eg. Nginx, Kong.
You can refer to the Nginx configuration file: `deploy/nginx-example.conf`.
