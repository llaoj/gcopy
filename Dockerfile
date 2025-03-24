# Build the frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./

RUN apk add --no-cache libc6-compat
RUN npm config delete proxy
RUN npm ci

COPY frontend/. .
COPY frontend/.env.sample .env.production

ENV NODE_ENV=production

RUN npm run build

# Build the backend
FROM golang AS backend-builder

ARG TARGETARCH

WORKDIR /app
COPY . .

RUN GOARCH=${TARGETARCH} make bin/gcopy

# Final stage: Combined container
FROM node:18-alpine 

LABEL maintainer="llaoj <hmmmbiubiubiu@gmail.com>"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3375
ENV HOSTNAME=0.0.0.0

# Install nginx
RUN apk add --no-cache nginx

# Copy backend binary
COPY --from=backend-builder /app/bin/gcopy /usr/local/bin/gcopy

# Copy frontend build
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static

# Expose port
EXPOSE 80

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

COPY --chmod=755 entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD [""]