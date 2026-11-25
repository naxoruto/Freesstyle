FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS builder
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY apps/server/package.json apps/server/tsconfig.json apps/server/tsconfig.build.json ./apps/server/
RUN pnpm install --frozen-lockfile

COPY packages/shared/src ./packages/shared/src
COPY apps/server/src ./apps/server/src
COPY apps/server/prisma ./apps/server/prisma
COPY apps/server/prisma.config.ts ./apps/server/
RUN pnpm --filter @freestyle/server prisma:generate \
    && pnpm --filter @freestyle/server build \
    && pnpm exec tsc -p packages/shared/tsconfig.json --module commonjs --moduleResolution node \
    && node -e "const fs=require('fs');const p='packages/shared/package.json';const pkg=JSON.parse(fs.readFileSync(p));pkg.main='./dist/index.js';fs.writeFileSync(p,JSON.stringify(pkg,null,2))"

FROM base AS runner
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/server ./apps/server
WORKDIR /app/apps/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
