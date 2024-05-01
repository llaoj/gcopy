FROM node:18-alpine AS base

FROM base AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
COPY frontend/. .
COPY frontend/.env.sample .env.production

RUN apk add --no-cache libc6-compat
RUN npm config delete proxy
RUN npm ci
RUN npm run build

FROM base AS runner
LABEL maintainer="llaoj <hmmmbiubiubiu@gmail.com>"

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

EXPOSE 3375
ENV PORT 3375
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
