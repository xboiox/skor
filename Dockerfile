# syntax=docker/dockerfile:1
# Production image (docs/DEPLOYMENT.md). Development uses Dockerfile.dev.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# One-off job: applies database migrations, then exits.
FROM deps AS migrator
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/server/db/schema.ts ./src/server/db/schema.ts
CMD ["npx", "drizzle-kit", "migrate"]

FROM deps AS builder
COPY . .
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Minimal runtime: the standalone server, static assets, non-root user.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
