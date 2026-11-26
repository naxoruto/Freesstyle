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
- Datos: PostgreSQL con Prisma; el estado en tiempo real aún depende en parte de la memoria del servidor.
- Monorepo: pnpm + Turborepo.

## Scripts

En Windows, abre **`Iniciar Freestyle.cmd`** con doble clic para iniciar el backend y la web y abrir el navegador. Requiere Node.js 22, dependencias instaladas y la base local configurada. Si PostgreSQL está apagado, intenta iniciar el contenedor existente `freestyle-db`; Docker Desktop debe estar funcionando. Si faltan migraciones, muestra el comando necesario y se detiene. Mantén la ventana abierta y pulsa `Ctrl+C` para detener frontend y backend. Consulta [Entorno local](docs/ENTORNO_LOCAL.md) para la preparación inicial.

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

- [INDEX.md](INDEX.md): punto de entrada y mapa del proyecto para personas e IA.
- [Cambios y prioridades](docs/producto/CAMBIOS.md): registro central de trabajo realizado, pendiente y en definición.
- [Brainstorming actual](docs/producto/brainstorming/00-estructura-y-perfil.md): experiencias de juego, estructura y perfil.
- [Entorno local](docs/ENTORNO_LOCAL.md): instalación, base aislada y verificaciones.
- [Recuperación de batallas](docs/RECUPERACION_BATALLAS.md): estado y contrato de recuperación.
- [Fuentes de datos](docs/datos/DATA_SOURCES.md): reglas de procedencia y prioridad.
- [Planes históricos](docs/archivo/): antecedentes; sus prioridades pueden estar desactualizadas.
