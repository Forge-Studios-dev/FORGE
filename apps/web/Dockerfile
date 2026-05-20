FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/design-system/package*.json ./packages/design-system/
COPY apps/web/package*.json ./apps/web/

RUN npm ci \
  --workspace=@forge/web \
  --workspace=@forge/shared-types \
  --workspace=@forge/design-system \
  --include-workspace-root

COPY packages/shared-types ./packages/shared-types
COPY packages/design-system ./packages/design-system
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

ARG NEXT_PUBLIC_API_URL=https://api.forgestudios.net/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace=@forge/shared-types \
  && npm run build --workspace=@forge/design-system \
  && npm run build --workspace=@forge/web

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
