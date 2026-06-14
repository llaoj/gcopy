# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json* ./
COPY frontend/. .

RUN apk add --no-cache libc6-compat
RUN npm config delete proxy
RUN npm ci
RUN npx update-browserslist-db@latest --force
RUN npm run build

# Stage 2: Build Backend (with embedded frontend)
FROM golang AS backend-builder

ARG TARGETARCH

WORKDIR /app
COPY . .

# Copy frontend build output into the Go embed directory
COPY --from=frontend-builder /frontend/out internal/static/dist

RUN GOARCH=${TARGETARCH} make bin/gcopy && \
    mv /app/bin/gcopy-*-linux-${TARGETARCH} /app/bin/gcopy

# Stage 3: Final Image (Go binary only)
FROM alpine
LABEL maintainer="llaoj <hmmmbiubiubiu@gmail.com>"

WORKDIR /app

RUN apk add --no-cache curl && \
    rm -rf /var/lib/apk/* /var/cache/apk/*

COPY --from=backend-builder /app/bin/gcopy /app/bin/gcopy

EXPOSE 3375

CMD ["/app/bin/gcopy"]
