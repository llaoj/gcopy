#!/bin/sh

# Convert environment variables to command line flags for gcopy backend
# Environment variables use GCOPY_ prefix to avoid conflicts

set -e

ARGS=""

# Required
if [ -n "$GCOPY_APP_KEY" ]; then
    ARGS="$ARGS -app-key=$GCOPY_APP_KEY"
fi

# Authentication mode
if [ -n "$GCOPY_AUTH_MODE" ]; then
    ARGS="$ARGS -auth-mode=$GCOPY_AUTH_MODE"
fi

# SMTP configuration
if [ -n "$GCOPY_SMTP_HOST" ]; then
    ARGS="$ARGS -smtp-host=$GCOPY_SMTP_HOST"
fi

if [ -n "$GCOPY_SMTP_PORT" ]; then
    ARGS="$ARGS -smtp-port=$GCOPY_SMTP_PORT"
fi

if [ -n "$GCOPY_SMTP_USERNAME" ]; then
    ARGS="$ARGS -smtp-username=$GCOPY_SMTP_USERNAME"
fi

if [ -n "$GCOPY_SMTP_PASSWORD" ]; then
    ARGS="$ARGS -smtp-password=$GCOPY_SMTP_PASSWORD"
fi

if [ -n "$GCOPY_SMTP_SENDER" ]; then
    ARGS="$ARGS -smtp-sender=$GCOPY_SMTP_SENDER"
fi

if [ "$GCOPY_SMTP_SSL" = "true" ]; then
    ARGS="$ARGS -smtp-ssl"
fi

# Server configuration
if [ -n "$GCOPY_LISTEN" ]; then
    ARGS="$ARGS -listen=$GCOPY_LISTEN"
fi

if [ -n "$GCOPY_MAX_CONTENT_LENGTH" ]; then
    ARGS="$ARGS -max-content-length=$GCOPY_MAX_CONTENT_LENGTH"
fi

# Debug mode
if [ "$GCOPY_DEBUG" = "true" ]; then
    ARGS="$ARGS -debug"
fi

# Start backend with converted arguments
# Add prefix to all log output for easy identification
exec /app/bin/gcopy $ARGS 2>&1 | sed -u 's/^/[backend] /'
