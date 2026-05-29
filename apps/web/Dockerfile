# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Accept build arg for WS URL (Next.js bakes NEXT_PUBLIC_* at build time)
ARG NEXT_PUBLIC_WS_URL=""
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Copy workspace config + all package.json files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/web/package.json apps/web/next.config.js apps/web/tsconfig.json apps/web/tailwind.config.js apps/web/postcss.config.js ./apps/web/

# Install ALL dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/src ./packages/shared/src
COPY apps/web/src ./apps/web/src
COPY apps/web/public ./apps/web/public

# Build Next.js (standalone output)
RUN pnpm --filter @freestyle/web build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

# Copy the standalone server (includes everything needed to run)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets that standalone doesn't include
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
# Standalone server is at apps/web/server.js
CMD ["node", "apps/web/server.js"]
