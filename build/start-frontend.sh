#!/bin/sh

# Start frontend with log prefix for easy identification
cd /app/frontend
exec node server.js 2>&1 | sed -u 's/^/[frontend] /'
