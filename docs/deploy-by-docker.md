# Deploy by Docker

GCopy provides a single container image with frontend embedded in the Go binary. 

## Quick Start

The browser Clipboard API requires HTTPS. The following example uses a self-signed certificate:

```bash
# 1. Generate a self-signed certificate
curl -sSL https://raw.githubusercontent.com/llaoj/gcopy/main/scripts/gen-cert.sh | bash

# 2. Start the container
docker run -d \
  --name gcopy \
  --restart unless-stopped \
  -p 3375:3375 \
  -v $(pwd)/cert.pem:/cert.pem:ro \
  -v $(pwd)/key.pem:/key.pem:ro \
  -e GCOPY_APP_KEY=your-secret-key-min-8-chars \
  -e GCOPY_AUTH_MODE=token \
  -e GCOPY_TLS_CERT_FILE=/cert.pem \
  -e GCOPY_TLS_KEY_FILE=/key.pem \
  llaoj/gcopy:latest
```

Visit `https://<host>:3375`. The browser will warn about the self-signed certificate — proceed to continue.

> You can also use a valid certificate or a reverse proxy for HTTPS. See [TLS Configuration](#tls-built-in-https) below.

## Configuration

All configuration is done via environment variables with the `GCOPY_` prefix.

### Token Authentication (Recommended for personal use)

```yaml
# docker run equivalent
-e GCOPY_APP_KEY=your-secret-key-min-8-chars
-e GCOPY_AUTH_MODE=token
```

No SMTP needed. Users authenticate with a 6-character token.

### Email Authentication

```yaml
-e GCOPY_APP_KEY=your-secret-key-min-8-chars
-e GCOPY_AUTH_MODE=email
-e GCOPY_SMTP_HOST=smtp.example.com
-e GCOPY_SMTP_PORT=587
-e GCOPY_SMTP_USERNAME=your-email@example.com
-e GCOPY_SMTP_PASSWORD=your-smtp-password
```

### TLS (Built-in HTTPS)

GCopy can load certificates to serve HTTPS directly, no reverse proxy needed:

```yaml
-e GCOPY_TLS_CERT_FILE=/path/to/cert.pem
-e GCOPY_TLS_KEY_FILE=/path/to/key.pem
# Mount the certificate files into the container
-v /path/to/cert.pem:/path/to/cert.pem:ro
-v /path/to/key.pem:/path/to/key.pem:ro
```

Both `GCOPY_TLS_CERT_FILE` and `GCOPY_TLS_KEY_FILE` must be set to enable TLS.

### Reverse Proxy

Run GCopy with HTTP and let a reverse proxy (Nginx, Caddy, etc.) handle TLS:

```yaml
-e GCOPY_LISTEN=127.0.0.1:3375
# No TLS environment variables needed
```

Configure the reverse proxy to forward HTTPS traffic to port 3375.

### Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GCOPY_APP_KEY` | Encryption key (min 8 characters) | - | Yes |
| `GCOPY_AUTH_MODE` | `email` or `token` | `email` | No |
| `GCOPY_LISTEN` | Listen address | `:3375` | No |
| `GCOPY_TLS_CERT_FILE` | TLS certificate file path | - | No |
| `GCOPY_TLS_KEY_FILE` | TLS key file path | - | No |
| `GCOPY_MAX_CONTENT_LENGTH` | Max clipboard size (MiB) | `10` | No |
| `GCOPY_DEBUG` | Debug mode | `false` | No |
| `GCOPY_SMTP_HOST` | SMTP server host | - | Email mode |
| `GCOPY_SMTP_PORT` | SMTP server port | `587` | No |
| `GCOPY_SMTP_USERNAME` | SMTP username | - | Email mode |
| `GCOPY_SMTP_PASSWORD` | SMTP password | - | Email mode |
| `GCOPY_SMTP_SENDER` | Email sender (defaults to username) | - | No |
| `GCOPY_SMTP_SSL` | Use SSL for SMTP | `false` | No |
