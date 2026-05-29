# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/src packages/shared/src
COPY apps/server/package.json apps/server/tsconfig.json apps/server/
COPY apps/server/src apps/server/src

# Build TypeScript
RUN pnpm --filter @freestyle/server build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY --from=builder /app/packages/shared/package.json /app/packages/shared/tsconfig.json ./packages/shared/
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Install production deps only
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
ENV WS_PORT=3001
EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
