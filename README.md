# Freestyle Arena

Plataforma de freestyle competitiva con:

- Batallas 1vs1 en tiempo real.
- Catalogo curado de freestylers.
- Inventario externo para revisar Fandom y FreestyleStats.
- Juego diario `Freestyler del dia`.
- Demo local de batalla y torneo eliminatorio.

## Estado Actual

- `Inicio`: crea o une salas de batalla.
- `Jugar`: `/juegos/freestyler`.
- `Catalogo`: `/catalogo`.
- `Inventario`: `/inventario`.
- `Demo 1vs1`: `/demo/1vs1`.
- `Torneos`: `/tournament`.

## Stack

- Frontend: Next.js 14 + React 18.
- Backend: Express + Socket.IO.
- Datos: PostgreSQL con Prisma, Redis para estado en tiempo real.
- Monorepo: pnpm + Turborepo.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Backend Util

```bash
pnpm --filter @freestyle/server catalog:report
pnpm --filter @freestyle/server inventory:report
pnpm --filter @freestyle/server catalog:sync:daily
pnpm --filter @freestyle/server inventory:promote:participations
```

## Docs

- `PLAN.md`: backlog de batalla y torneo.
- `GAMES_PLAN.md`: diseño de juegos diarios.
- `DATA_SOURCES.md`: reglas de procedencia y prioridad.
- `HANDOFF.md`: snapshot operativo para retomar trabajo.
