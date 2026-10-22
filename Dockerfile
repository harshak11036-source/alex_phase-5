# =============================================================================
# ALEX - Multi-stage Dockerfile for Next.js (standalone) + Worker
# =============================================================================
# Targets:
#   - runner-api: Next.js standalone server (API routes + SSR)
#   - runner-worker: Background job worker (document processing, scheduled jobs)
# =============================================================================

# -----------------------------------------------------------------------------
# Base image with Node.js 20 (LTS) and pnpm
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Prisma is used during the Next.js build to prerender authenticated-aware
# routes. Install OpenSSL in every build stage so Prisma selects the Alpine
# OpenSSL 3 engine, matching the production runtime.
RUN apk add --no-cache openssl \
 && corepack enable \
 && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# -----------------------------------------------------------------------------
# Install dependencies (cached layer)
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/validation-schemas/package.json ./packages/validation-schemas/
RUN pnpm install --frozen-lockfile --ignore-scripts

# -----------------------------------------------------------------------------
# Generate Prisma Client
# -----------------------------------------------------------------------------
FROM deps AS prisma
COPY apps/web/prisma ./apps/web/prisma
RUN pnpm --filter apps/web run db:generate

# -----------------------------------------------------------------------------
# Build shared packages
# -----------------------------------------------------------------------------
FROM prisma AS build-packages
COPY packages ./packages
RUN pnpm --filter @alex/shared-types run build \
 && pnpm --filter @alex/shared-utils run build \
 && pnpm --filter @alex/validation-schemas run build

# -----------------------------------------------------------------------------
# Build Next.js (standalone output for production server)
# -----------------------------------------------------------------------------
FROM build-packages AS build-web
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter apps/web run build

# -----------------------------------------------------------------------------
# Production runtime: Next.js standalone server (API + SSR)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner-api
ENV NODE_ENV=production
WORKDIR /app

# Prisma 5's Linux engine requires OpenSSL at runtime on Alpine.
RUN apk add --no-cache openssl

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Copy standalone output
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma

# Copy node_modules for Prisma and other deps
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Apply the Prisma schema on first deploy/start, then launch Next.js.
# This creates the Neon tables required by registration and all API features.
# Apply only non-destructive schema synchronization at startup. Do not use
# --accept-data-loss in production; Prisma must fail closed if a schema change
# could discard data. Prefer reviewed, committed migrations for ongoing changes.
CMD ["sh", "-c", "node node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js db push --schema=apps/web/prisma/schema.prisma --skip-generate && node apps/web/server.js"]

# -----------------------------------------------------------------------------
# Production runtime: Background worker
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner-worker
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001 -G nodejs

# Install runtime libraries for Prisma and OCR.
RUN apk add --no-cache openssl tesseract-ocr

# Copy built application
COPY --from=build-web --chown=worker:nodejs /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=worker:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=worker:nodejs /app/apps/web/public ./apps/web/public
COPY --from=build-web --chown=worker:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=deps --chown=worker:nodejs /app/node_modules ./node_modules

# Copy worker entry point
COPY --chown=worker:nodejs docker/worker-entrypoint.js ./worker-entrypoint.js

USER worker

CMD ["node", "worker-entrypoint.js"]

# Render's Docker service builds the final stage by default. Keep the API as
# the default production target; the worker stage remains available for a
# separately configured worker service.
FROM runner-api AS final
