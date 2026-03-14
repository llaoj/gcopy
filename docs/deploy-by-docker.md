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

GCopy provides a single Docker image that contains both frontend and backend services. The image uses supervisord for process management and exposes only one port (3375).

### Create `docker-compose.yml`

Create directory and download `deploy/docker-compose.yml` to the directory:

```bash
# The directory location can be customized.
mkdir -p /opt/gcopy
wget -O /opt/gcopy/docker-compose.yml https://raw.githubusercontent.com/llaoj/gcopy/main/deploy/docker-compose.yml
```

### Configuration

GCopy uses environment variables for configuration. All environment variables use the `GCOPY_` prefix to avoid conflicts with other variables.

#### Email Authentication Mode (Default)

Edit `docker-compose.yml`:

```yaml
services:
  gcopy:
    environment:
      - GCOPY_APP_KEY=your-secret-key-min-8-chars
      - GCOPY_AUTH_MODE=email
      - GCOPY_MAX_CONTENT_LENGTH=10
      - GCOPY_SMTP_HOST=smtp.example.com
      - GCOPY_SMTP_PORT=587
      - GCOPY_SMTP_USERNAME=your-email@example.com
      - GCOPY_SMTP_PASSWORD=your-smtp-password
      - GCOPY_SMTP_SSL=false
```

#### Token Authentication Mode

Edit `docker-compose.yml`:

```yaml
services:
  gcopy:
    environment:
      - GCOPY_APP_KEY=your-secret-key-min-8-chars
      - GCOPY_AUTH_MODE=token
      - GCOPY_MAX_CONTENT_LENGTH=10
```

**Note:** Token mode does not require SMTP configuration, making it ideal for:
- Intranet/LAN environments
- Personal use
- Trusted team environments

### Environment Variables Reference

| Environment Variable | Description | Default | Required |
|---------------------|-------------|---------|----------|
| `GCOPY_APP_KEY` | Secret key for encryption (min 8 characters) | - | ✅ Yes |
| `GCOPY_AUTH_MODE` | Authentication mode: `email` or `token` | `email` | No |
| `GCOPY_LISTEN` | Backend listen address | `0.0.0.0:3376` | No |
| `GCOPY_MAX_CONTENT_LENGTH` | Max clipboard size in MiB | `10` | No |
| `GCOPY_DEBUG` | Enable debug mode: `true` or `false` | `false` | No |
| `GCOPY_SMTP_HOST` | SMTP server host | - | Yes (email mode) |
| `GCOPY_SMTP_PORT` | SMTP server port | `587` | No |
| `GCOPY_SMTP_USERNAME` | SMTP username | - | Yes (email mode) |
| `GCOPY_SMTP_PASSWORD` | SMTP password | - | Yes (email mode) |
| `GCOPY_SMTP_SENDER` | Email sender address | (username) | No |
| `GCOPY_SMTP_SSL` | Use SSL connection | `false` | No |

### Start the containers

```sh
cd /opt/gcopy
docker-compose up -d
```

### View Logs

The container outputs both frontend and backend logs to stdout/stderr with prefixes:

```sh
# View all logs
docker logs gcopy

# Follow logs in real-time
docker logs -f gcopy
```

Example output:
```
[backend] The server has started!
[frontend] ▲ Next.js 15.1.6
[frontend]   - Local:        http://localhost:3375
```

## Behind a Proxy

HTTPS is required. We recommend deploying it behind a reverse proxy such as Nginx, Kong, or Apisix.

You can refer to the Nginx configuration file: `deploy/nginx-example.conf`. The configuration only needs to proxy to port 3375 (frontend port), as the frontend handles API routing internally.

### Important Notes

1. **Single Port**: The container only exposes port 3375. Frontend and backend communicate internally.
2. **No TLS Configuration**: TLS is handled by the reverse proxy, not by GCopy backend.
3. **No Frontend Config File**: The frontend configuration is built into the image, no separate `.env.production` file needed.
