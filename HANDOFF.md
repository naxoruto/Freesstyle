# Freestyle Platform Handoff

Fecha: 2026-07-28

Este documento resume el estado actual del proyecto para retomar trabajo en otro chat sin perder contexto.

## Objetivo Actual

La base de datos ya quedo suficientemente limpia y curada para empezar a disenar nuevos juegos usando freestylers reales, paises, participaciones, titulos y evidencia competitiva.

El siguiente foco recomendado es disenar e implementar los demas juegos, empezando por Grid.

## Estado De Datos

Catalogo local actual:
- Total freestylers: 1044
- Publicados: 257
- Candidatos: 786
- Con ano de nacimiento: 202
- FMS confirmado: 116
- Con evidencia competitiva: 158
- Daily elegibles: 158
- Issues abiertos: 665

Nota: estos números son el ultimo snapshot documentado. Para recalcularlos hace falta levantar PostgreSQL local en `127.0.0.1:5433` y volver a correr los reportes.

Inventario externo actual:
- Perfiles externos totales: 5302
- Fandom: 258 perfiles
- FreestyleStats: 5044 perfiles
- Fandom vinculados: 251
- FreestyleStats vinculados: 868

Cobertura externa:
- Fandom wins: 218
- Fandom daily wins: 164
- FreestyleStats participaciones: 12003
- FreestyleStats wins: 698
- FreestyleStats daily wins: 227

Promocion de participaciones externas:
- Participaciones externas revisadas: 3634
- Participaciones externas mapeadas: 2810
- Participaciones locales creadas: 1118
- Pendientes sin mapeo claro: 824
- El promotor es idempotente: dry-run posterior muestra `newParticipations: 0`

## Decisiones De Curacion

Prioridad de fuentes:
- Fandom > FreestyleStats > FMS/Red Bull

Identidad:
- No se fusiona solo por alias.
- La resolucion automatica usa alias normalizado + pais + ano compatible.
- Si el ano falta en una fuente, no contradice.
- Si ambos anos existen y difieren, no se vincula automaticamente.

Participaciones:
- `external_participations` son evidencia externa cruda.
- `participations` son confirmaciones locales usadas por juegos.
- Solo se promueven participaciones externas si el perfil externo ya esta vinculado a un freestyler local y la competencia se puede mapear con confianza.

Red Bull:
- Participar en Red Bull nacional/regional crea participacion local `red-bull-batalla`.
- Solo `Red Bull Batalla Internacional` marca `redBullInternational: true`.
- Caso Alek validado: tiene Red Bull Espana, no Red Bull Internacional.

FMS:
- Participaciones externas FMS se mapean a competencia local `fms`.
- `fmsParticipant` se actualiza solo si habia participacion FMS local y el flag no era true.
- Actualmente no hay inconsistencias: ningun perfil tiene participacion FMS local con `fmsParticipant != true`.

## Scripts Importantes

Servidor:

```bash
pnpm --filter @freestyle/server catalog:report
pnpm --filter @freestyle/server inventory:report
pnpm --filter @freestyle/server inventory:resolve
pnpm --filter @freestyle/server inventory:promote:participations -- --dry-run
pnpm --filter @freestyle/server inventory:promote:participations
pnpm --filter @freestyle/server typecheck
```

Importadores completos:

```bash
pnpm --filter @freestyle/server inventory:fandom
pnpm --filter @freestyle/server inventory:freestyle-stats
```

Nota: no hace falta reimportar inventario para seguir disenando juegos.

## UI Disponible

Catalogo:

```text
/catalogo
```

Juego diario:

```text
/juegos/freestyler
/juegos/freestyler?demo=1
```

Batallas y demos:

```text
/
/battle/:id
/demo/1vs1
```

Torneos:

```text
/tournament
```

Inventario externo:

```text
/inventario
```

En `/inventario` se puede:
- Buscar perfiles externos.
- Filtrar por fuente.
- Filtrar vinculados/sin vinculo.
- Abrir ficha externa.
- Revisar participaciones sin mapeo.

La seccion `Participaciones sin mapeo` muestra los 824 pendientes manuales.

## Endpoints Nuevos

Juego diario:

```text
GET /api/games/freestyler/today
POST /api/games/freestyler/today/guesses
POST /api/games/freestyler/today/give-up
```

Batallas y torneos:

```text
POST /api/battles
POST /api/tournaments
POST /api/tournaments/:id/participants
POST /api/tournaments/:id/start
POST /api/tournaments/:id/winners
GET /api/tournaments/:id/battles/:battleId/access
GET /api/tournaments/:id
```

Inventario:

```text
GET /api/inventory/report
GET /api/inventory/profiles
GET /api/inventory/profiles/:id
GET /api/inventory/pending-participations
```

Catalogo existente:

```text
GET /api/catalog/freestylers
GET /api/catalog/freestylers/:slug
```

## Archivos Relevantes

Curacion e inventario:
- `apps/server/prisma/schema.prisma`
- `apps/server/prisma/migrations/20260728180000_add_external_inventory/migration.sql`
- `apps/server/src/importers/inventoryFandom.ts`
- `apps/server/src/importers/inventoryFreestyleStats.ts`
- `apps/server/src/importers/inventoryPersistence.ts`
- `apps/server/src/importers/inventoryShared.ts`
- `apps/server/src/importers/resolveExternalIdentities.ts`
- `apps/server/src/importers/promoteExternalParticipations.ts`
- `apps/server/src/importers/reportInventory.ts`
- `apps/server/src/inventory/inventory.ts`
- `apps/server/src/inventory/participationMapping.ts`

Catalogo y Daily:
- `apps/server/src/catalog/catalog.ts`
- `apps/server/src/games/freestylerDaily.ts`
- `apps/server/src/importers/reportCatalog.ts`
- `apps/server/src/importers/auditDailyConsistency.ts`
- `apps/server/src/importers/syncDailyEvidence.ts`

Web:
- `apps/web/src/app/catalogo/CatalogClient.tsx`
- `apps/web/src/app/inventario/InventoryClient.tsx`
- `apps/web/src/app/inventario/page.tsx`
- `apps/web/src/app/globals.css`

## Problemas Conocidos

`prisma generate` fallo en Windows por bloqueo de DLL:

```text
EPERM: operation not permitted, rename ... query_engine-windows.dll.node.tmp... -> ... query_engine-windows.dll.node
```

La migracion si se aplico. Para evitar depender de cliente Prisma regenerado, los scripts nuevos de inventario usan SQL parametrizado cuando acceden a tablas nuevas.

Probable solucion si hace falta regenerar:
- Cerrar procesos Node/Next/tsx que esten usando Prisma.
- Reintentar `pnpm --filter @freestyle/server prisma:generate`.

Backup previo a inventario:

```text
freestyle-before-inventory.dump
```

## Casos Validados

Alek:
- Fandom Alek vinculado a Alek local.
- FreestyleStats Alek vinculado a Alek local.
- Tiene FMS y Red Bull Espana.
- No tiene Red Bull Internacional.
- `redBullInternational: false` es correcto.

Anubis:
- Fandom Anubis CL 1999 vinculado a Anubis.
- FreestyleStats Anubis CL 1999 vinculado a Anubis.
- FreestyleStats Anubisse ES 2019 queda sin vincular.

## Proximo Trabajo Recomendado

Empezar por el juego Grid.

Idea base:
- Juego tipo Immaculate Grid.
- Celdas formadas por restricciones de pais, competencia, titulo, FMS, Red Bull, etc.
- El jugador debe elegir un freestyler que cumpla fila y columna.

Datos disponibles para Grid:
- `freestylers.country`
- `freestylers.birthYear`
- `freestylers.fmsParticipant`
- `freestylers.redBullInternational`
- `participations.competition`
- `titles.competition`
- `catalogStatus`

Posibles categorias:
- Pais: Argentina, Chile, Espana, Mexico, Peru, Colombia
- Competencia: FMS, Red Bull Batalla, God Level, BDM, Gold Battle, Supremacia MC
- Atributos: campeon, participante FMS, Red Bull Internacional, nacido antes/despues de cierto ano

Recomendacion de implementacion:
1. Crear generador server-side de puzzle Grid.
2. Validar que cada celda tenga al menos N respuestas posibles.
3. Persistir puzzle diario o generar deterministico por fecha.
4. Crear endpoint REST para puzzle y guesses.
5. Implementar UI web.

## Comandos Para Retomar

Levantar app:

```bash
pnpm dev
```

Abrir:

```text
http://localhost:3002/catalogo
http://localhost:3002/inventario
```

Revisar estado:

```bash
pnpm --filter @freestyle/server catalog:report
pnpm --filter @freestyle/server inventory:report
pnpm --filter @freestyle/server inventory:promote:participations -- --dry-run
```
