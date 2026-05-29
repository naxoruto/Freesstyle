# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

ENV NEXT_PUBLIC_WS_URL=

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

# Build Next.js
RUN pnpm --filter @freestyle/web build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy only production-needed files
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/next.config.js ./apps/web/
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next ./apps/web/.next

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000
CMD ["sh", "-c", "cd apps/web && npx next start ."]
