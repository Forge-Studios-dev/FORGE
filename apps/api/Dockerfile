FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/ ./packages/

RUN npm ci --workspace=apps/api

COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

RUN npm run build --workspace=@forge/shared-types \
  && npm run build --workspace=apps/api

# --- Production stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# H-B2: API image mirrors Dockerfile.worker — Mux is the production transcode
# provider (VIDEO_TRANSCODE_PROVIDER=mux) so ffmpeg stays opt-in via
# --build-arg INCLUDE_FFMPEG=true (local dev only).
ARG INCLUDE_FFMPEG=false
RUN if [ "$INCLUDE_FFMPEG" = "true" ]; then apk add --no-cache ffmpeg; fi
RUN apk add --no-cache curl

ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN npm ci --workspace=apps/api --omit=dev

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared-types/dist ./packages/shared-types/dist

# Nest monorepo build emits dist/apps/api/src/main.js (not dist/main.js).
RUN test -f apps/api/dist/apps/api/src/main.js

COPY --chown=nestjs:nodejs apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x apps/api/docker-entrypoint.sh

USER nestjs

EXPOSE 3001

# No continuous HEALTHCHECK — /api/v1/health/* remains available for manual curl.

CMD ["apps/api/docker-entrypoint.sh"]
