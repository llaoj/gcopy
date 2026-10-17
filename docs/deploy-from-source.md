# Deploy from Source

GCopy is a single Go binary with the frontend embedded — no separate frontend deployment needed.

## Get the Binary

### Build from Source

Prerequisites: Go 1.20+, Node.js 18.17+, git

```bash
git clone https://github.com/llaoj/gcopy.git
cd gcopy
make bin/gcopy
```

Build process: compile Next.js frontend to static files → embed via `go:embed` → produce `bin/gcopy`

### Download from Release

Download the binary for your platform from [GitHub Releases](https://github.com/llaoj/gcopy/releases).

## Quick Start

The browser Clipboard API requires HTTPS. The following example uses a self-signed certificate:

```bash
# 1. Generate a self-signed certificate
curl -sSL https://raw.githubusercontent.com/llaoj/gcopy/main/scripts/gen-cert.sh | bash

# 2. Start
./gcopy -app-key=<your-key> -tls-cert-file=cert.pem -tls-key-file=key.pem
```

Visit `https://<host>:3375`. The browser will warn about the self-signed certificate — proceed to continue.

> You can also use a valid certificate or a reverse proxy for HTTPS. See [HTTPS Configuration](#https-configuration) below.

## Authentication

All configuration can be done via command-line flags or environment variables (with `GCOPY_` prefix). Users authenticate with an 8-character token.

## HTTPS Configuration

The browser Clipboard API requires HTTPS. You must configure HTTPS for GCopy to work.

### Self-Signed Certificate (Quick Test)

```bash
curl -sSL https://raw.githubusercontent.com/llaoj/gcopy/main/scripts/gen-cert.sh | bash
```

Use this script to generate a local self-signed certificate. The browser will warn about the certificate — proceed to continue.

Alternatively, for production, it is recommended to obtain a valid certificate for your domain, then:

### Domain Certificate

```bash
...
-tls-cert-file=/path/to/cert.pem \
-tls-key-file=/path/to/key.pem
```

With a certificate configured, GCopy serves HTTPS directly — no reverse proxy needed.

### Reverse Proxy

Run GCopy with HTTP and let a reverse proxy (Nginx, Caddy, etc.) handle TLS:

```bash
...
-listen=127.0.0.1:3375
```

Configure the reverse proxy to forward HTTPS traffic to port 3375.

## Configuration Reference

| Flag | Environment Variable | Default | Description |
|------|---------------------|---------|-------------|
| `-app-key` | `GCOPY_APP_KEY` | - | Encryption key (min 8 characters, required) |
| `-listen` | `GCOPY_LISTEN` | `:3375` | Listen address |
| `-tls-cert-file` | `GCOPY_TLS_CERT_FILE` | - | TLS certificate file |
| `-tls-key-file` | `GCOPY_TLS_KEY_FILE` | - | TLS key file |
| `-max-content-length` | `GCOPY_MAX_CONTENT_LENGTH` | `10` | Max clipboard size (MiB) |
| `-debug` | `GCOPY_DEBUG` | `false` | Debug mode |
| `-version` | - | `false` | Print version |

## Development

For development with hot-reload, use `scripts/dev.sh` which starts the frontend and backend as separate processes:

```bash
./scripts/dev.sh
```

- Frontend: `https://localhost:3375` (Next.js dev server with HTTPS)
- Backend: `https://localhost:3376` (Go server with TLS)
