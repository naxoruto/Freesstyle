# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace config + all package.json files needed for install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/server/package.json apps/server/tsconfig.json ./apps/server/

# Install ALL dependencies (root + all workspace packages)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/src ./packages/shared/src
COPY apps/server/src ./apps/server/src

# Build TypeScript
RUN pnpm --filter @freestyle/server build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace config + built files for prod
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
