#!/bin/sh

set -eu

# Validate required environment variables
if [ -z "${APP_KEY:-}" ] || [ -z "${SMTP_HOST:-}" ] || [ -z "${SMTP_USERNAME:-}" ] || [ -z "${SMTP_PASSWORD:-}" ]; then
    echo "Error: Required environment variables are not set"
    echo "Required: APP_KEY, SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD"
    exit 1
fi

# Start nginx
nginx -g 'daemon off;' &

# Start gcopy backend with default values where appropriate
/usr/local/bin/gcopy \
    --app-key="${APP_KEY}" \
    --smtp-host="${SMTP_HOST}" \
    --smtp-port="${SMTP_PORT:-587}" \
    --smtp-username="${SMTP_USERNAME}" \
    --smtp-password="${SMTP_PASSWORD}" \
    --smtp-ssl="${SMTP_SSL:-true}" \
    --smtp-sender="${SMTP_SENDER:-${SMTP_USERNAME}}" \
    --max-content-length="${MAX_CONTENT_LENGTH:-10}" &

# Wait for backend to be ready
sleep 2

# Start frontend
cd /app && NODE_ENV=production PORT=3375 exec node server.js &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?

