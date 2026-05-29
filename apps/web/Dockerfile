# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY apps/web/package.json apps/web/next.config.js apps/web/tsconfig.json apps/web/tailwind.config.js apps/web/postcss.config.js apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/shared/src packages/shared/src
COPY apps/web/src apps/web/src
COPY apps/web/public apps/web/public

ARG NEXT_PUBLIC_WS_URL=http://localhost:3001/ws
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
RUN pnpm --filter @freestyle/web build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/next.config.js ./apps/web/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/node_modules ./node_modules
COPY pnpm-workspace.yaml package.json ./

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npx", "next", "start", "apps/web"]
