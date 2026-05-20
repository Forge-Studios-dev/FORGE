FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/design-system/package*.json ./packages/design-system/
COPY apps/admin/package*.json ./apps/admin/

RUN npm ci \
  --workspace=@forge/admin \
  --workspace=@forge/shared-types \
  --workspace=@forge/design-system \
  --include-workspace-root

COPY packages/shared-types ./packages/shared-types
COPY packages/design-system ./packages/design-system
COPY apps/admin ./apps/admin
COPY tsconfig.base.json ./

ARG NEXT_PUBLIC_API_URL=https://api.forgestudios.net/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace=@forge/shared-types \
  && npm run build --workspace=@forge/design-system \
  && npm run build --workspace=@forge/admin

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/admin/public ./apps/admin/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs

EXPOSE 3002

CMD ["node", "apps/admin/server.js"]
