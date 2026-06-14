#!/bin/bash

set -e

# Project root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

CERT_FILE="$ROOT_DIR/.dev/127.0.0.1.pem"
KEY_FILE="$ROOT_DIR/.dev/127.0.0.1-key.pem"

mkdir -p "$ROOT_DIR/.dev"
"$ROOT_DIR/scripts/gen-cert.sh" "$CERT_FILE" "$KEY_FILE"

# Start backend in background
echo "Starting backend..."
cd "$ROOT_DIR"
go run cmd/gcopy.go \
    -app-key=change-me \
    -auth-mode=token \
    -listen=:3376 \
    -debug &
BACKEND_PID=$!

# Start frontend in background
echo "Starting frontend..."
cd "$ROOT_DIR/frontend"
export SERVER_URL=http://localhost:3376
npx next dev -p 3375 \
    --experimental-https \
    --experimental-https-key="$KEY_FILE" \
    --experimental-https-cert="$CERT_FILE" &
FRONTEND_PID=$!

cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
}
trap cleanup EXIT INT TERM

echo ""
echo "GCopy dev environment started!"
echo "  Frontend: https://localhost:3375"
echo "  Backend:  http://localhost:3376"
echo ""

wait
