# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json* ./
COPY frontend/. .

# Set SERVER_URL to localhost since frontend and backend are in the same container
RUN echo "SERVER_URL=http://localhost:3376" > .env.production

RUN apk add --no-cache libc6-compat
RUN npm config delete proxy
RUN npm ci
RUN npx update-browserslist-db@latest --force
RUN npm run build

# Stage 2: Build Backend
FROM golang AS backend-builder

ARG TARGETARCH

WORKDIR /app
COPY . .

RUN GOARCH=${TARGETARCH} make bin/gcopy

# Stage 3: Final Image
FROM alpine
LABEL maintainer="llaoj <hmmmbiubiubiu@gmail.com>"

WORKDIR /app

# Install node and supervisor for process management
# Clean up APK metadata to reduce image size
RUN apk add --no-cache nodejs supervisor && \
    rm -rf /var/lib/apk/* /var/cache/apk/*

# Create directories
RUN mkdir -p /app/frontend /app/backend /var/run/supervisor

# Copy frontend build
COPY --from=frontend-builder /frontend/public ./frontend/public
COPY --from=frontend-builder --chown=node:node /frontend/.next/standalone ./frontend/
COPY --from=frontend-builder --chown=node:node /frontend/.next/static ./frontend/.next/static

# Copy backend binary
COPY --from=backend-builder /app/bin/gcopy /app/bin/gcopy

# Copy startup script and supervisord configuration
COPY build/start-backend.sh /app/backend/start.sh
RUN chmod +x /app/backend/start.sh
COPY build/start-frontend.sh /app/frontend/start.sh
RUN chmod +x /app/frontend/start.sh
COPY build/supervisord.conf /etc/supervisord.conf

# Expose ports (frontend: 3375)
EXPOSE 3375

# Environment variables
ENV NODE_ENV=production
ENV PORT=3375
ENV HOSTNAME=0.0.0.0

# Use supervisord as the entrypoint
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
