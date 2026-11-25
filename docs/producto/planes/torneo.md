# Plan de implementación — Torneo (Fase 2)

> **For agentic workers:** implementar tarea por tarea, en orden. Cada tarea termina con commit + push (regla de `AGENTS.md`).

**Goal:** Torneo recuperable y claro: identidad, inscripción por enlace/manual, sorteo con auditoría, cuadro en vivo y repesca por suplentes.

**Architecture:** Next.js (web) + Express/Socket.IO (server) + `@freestyle/shared` (contratos) + Prisma (persistencia del torneo). Se replica el patrón de persistencia ya usado en las batallas.

**Tech Stack:** TypeScript, React 18, Next.js 14, Prisma/PostgreSQL, Socket.IO, vitest (server).

**Spec:** [torneo.md](../producto/specs/torneo.md)

## Global Constraints

- No exponer `.env` ni credenciales; commitear y pushear al terminar cada tarea.
- Pruebas que crean/eliminan registros → base descartable (`freestyle-audit-postgres`).
- El web no tiene runner de tests aún (DX-01); las tareas de frontend se verifican con `pnpm --filter @freestyle/web typecheck` + recorrido manual.
- Preservar los cambios existentes del usuario.

## Orden y dependencias

```
T1 (tipos compartidos) → T2 (modelo Prisma) → T3 (persistencia TOR-01)
T4 (creación) → T5 (inscripción) → T6 (sorteo+auditoría) → T7 (suplentes) → T8 (recuperación)
T9 (form) → T10 (inscripción UI) → T11 (sorteo UI) → T12 (cuadro en vivo) → T13 (repesca UI)
```

---

## T1 — Tipos compartidos de torneo

**Files:** `packages/shared/src/types.ts`

**Interfaces:** ampliar `Tournament` con `logo?`, `organizer?`, `capacity`, `suplentes`, `auditLog`.

- [ ] **Paso 1 — Implementar**: añadir los campos al tipo `Tournament` (logo/organizador opcionales; `capacity: 4|8|16`; `suplentes: TournamentParticipant[]`; `auditLog: { at: string; actorId: string; action: string; detail: string }[]`).
- [ ] **Paso 2 — Verificar**: `pnpm --filter @freestyle/server typecheck`.
- [ ] **Paso 3 — Commit**: `feat(shared): ampliar contrato de torneo`.

## T2 — Modelo Prisma de torneo

**Files:** `apps/server/prisma/schema.prisma`

**Interfaces:** modelo `Tournament` (id, name, logo?, organizer?, type, capacity, status, data JSON, createdAt/updatedAt).

- [ ] **Paso 1 — Implementar**: añadir el modelo (guardar el estado en un campo `data Json` para iterar rápido; las fases/resultados viven ahí).
- [ ] **Paso 2 — Migrar**: `$env:DATABASE_URL=...; pnpm --filter @freestyle/server exec prisma migrate dev --name add_tournament`.
- [ ] **Paso 3 — Commit**: `feat(server): modelo de torneo en Prisma`.

## T3 — Persistencia y recuperación (TOR-01)

**Files:** `apps/server/src/rooms/tournamentPersistence.ts` (nuevo), `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `TournamentPersistence` con `create`, `update`, `loadActive`; el manager persiste en cada mutación.

- [ ] **Paso 1 — Test que falla**: crear un torneo, guardarlo, leerlo y verificar que `loadActive` lo devuelve.
- [ ] **Paso 2 — Implementar**: `TournamentPersistence` (patrón de `BattlePersistence`).
- [ ] **Paso 3 — Ejecutar** → PASS.
- [ ] **Paso 4 — Commit**: `feat(server): persistencia de torneos`.

## T4 — Creación (tipo, identidad, capacidad)

**Files:** `apps/server/src/rooms/tournamentRoom.ts`, `apps/server/src/index.ts`

**Interfaces:** `createTournament` acepta `type` (sin `king_of_the_hill`), `name`, `logo?`, `organizer?`, `capacity` (4/8/16).

- [ ] **Paso 1 — Test que falla**: validar capacidad (rechaza 3/7/9) y tipo (rechaza `king_of_the_hill`).
- [ ] **Paso 2 — Implementar**: validación y campos nuevos.
- [ ] **Paso 3 — Ejecutar** → PASS.
- [ ] **Paso 4 — Commit**: `feat(server): creación de torneo con tipo, identidad y capacidad`.

## T5 — Inscripción (titulares y suplentes)

**Files:** `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `addParticipant` mantiene titulares (primeros `capacity`) y suplentes (resto) en orden de inscripción.

- [ ] **Paso 1 — Test que falla**: inscribir `capacity + 2` participantes → `capacity` titulares y 2 suplentes.
- [ ] **Paso 2 — Implementar**.
- [ ] **Paso 3 — Ejecutar** → PASS.
- [ ] **Paso 4 — Commit**: `feat(server): inscripción con titulares y suplentes`.

## T6 — Sorteo, reorden y auditoría

**Files:** `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `sortParticipants()` (aleatorio) y `reorderParticipants()` que registran en `auditLog`.

- [ ] **Paso 1 — Test que falla**: reordenar registra una entrada en `auditLog` con actor y acción.
- [ ] **Paso 2 — Implementar**.
- [ ] **Paso 3 — Ejecutar** → PASS.
- [ ] **Paso 4 — Commit**: `feat(server): sorteo y reorden con auditoría`.

## T7 — Sustitución por suplente

**Files:** `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `substituteParticipant(absentId)` reemplaza al ausente por el siguiente suplente y registra la sustitución.

- [ ] **Paso 1 — Test que falla**: sustituir a un titular ausente → el suplente toma su puesto y se registra en `auditLog`.
- [ ] **Paso 2 — Implementar**.
- [ ] **Paso 3 — Ejecutar** → PASS.
- [ ] **Paso 4 — Commit**: `feat(server): repesca por suplentes`.

## T8 — Recuperación tras reinicio

**Files:** `apps/server/src/index.ts`, `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `loadTournamentsFromDb()` restaura torneos en arranque.

- [ ] **Paso 1 — Test que falla**: cargar torneos activos desde la persistencia.
- [ ] **Paso 2 — Implementar** (llamar en `index.ts` al arrancar).
- [ ] **Paso 3 — Ejecutar** → PASS.
- [ ] **Paso 4 — Commit**: `feat(server): recuperación de torneos`.

## T9 — Formulario de creación (web)

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** tipo primero, nombre + logo/organizador opcionales, capacidad; campo de participantes vacío + «Cargar ejemplo»; sin Rey de la pista.

- [ ] **Paso 1 — Implementar**.
- [ ] **Paso 2 — Verificar**: `pnpm --filter @freestyle/web typecheck` + recorrido manual.
- [ ] **Paso 3 — Commit**: `feat(web): formulario de torneo (tipo, identidad, capacidad)`.

## T10 — Inscripción (web)

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** enlace de invitación + agregar a mano + confirmar titulares/suplentes (A13).

- [ ] **Paso 1 — Implementar**.
- [ ] **Paso 2 — Verificar**: typecheck + manual.
- [ ] **Paso 3 — Commit**: `feat(web): inscripción por enlace y manual`.

## T11 — Sorteo y revisión con auditoría (web)

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** «Sortear» separado de «Iniciar»; reorden con flechas; visor de auditoría.

- [ ] **Paso 1 — Implementar**.
- [ ] **Paso 2 — Verificar**: typecheck + manual.
- [ ] **Paso 3 — Commit**: `feat(web): sorteo revisable con auditoría`.

## T12 — Cuadro en vivo (web)

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** panel «Ahora / Después», cuadro actualizado en vivo, retorno a la misma sala.

- [ ] **Paso 1 — Implementar**.
- [ ] **Paso 2 — Verificar**: typecheck + manual.
- [ ] **Paso 3 — Commit**: `feat(web): cuadro en vivo y panel ahora/después`.

## T13 — Repesca (web)

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** marcar ausencia y sustituir por suplente (visible para todos).

- [ ] **Paso 1 — Implementar**.
- [ ] **Paso 2 — Verificar**: typecheck + manual.
- [ ] **Paso 3 — Commit**: `feat(web): repesca por suplentes`.

---

## Orden recomendado de ejecución

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 (backend, TDD) · T9 → T10 → T11 → T12 → T13 (web).

Cada tarea es independiente en su ciclo de test; se commitea y pushea al terminar.
