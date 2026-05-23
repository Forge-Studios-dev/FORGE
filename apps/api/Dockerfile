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

RUN apk add --no-cache ffmpeg curl

ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN npm ci --workspace=apps/api --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

# Fail the image build if Nest output path drifts (prevents Fly crash-loop on missing main.js).
RUN test -f apps/api/dist/main.js

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
