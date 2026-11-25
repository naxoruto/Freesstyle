# Plan de implementación — Torneo (Fase 2)

> **For agentic workers:** implementar tarea por tarea, en orden. Cada tarea termina con commit + push (regla de `AGENTS.md`).

**Goal:** Torneo recuperable y claro: identidad, inscripción por enlace/manual, sorteo con auditoría, cuadro en vivo y repesca por suplentes.

**Architecture:** Next.js (web) + Express/Socket.IO (server) + `@freestyle/shared` (contratos) + Prisma (persistencia del torneo). Se replica el patrón de persistencia ya usado en las batallas.

**Tech Stack:** TypeScript, React 18, Next.js 14, Prisma/PostgreSQL, Socket.IO, vitest (server).

**Spec:** [torneo.md](../specs/torneo.md)

## Estado (actualizado el 25 de noviembre de 2026)

| Tarea | Estado | Commit |
|---|---|---|
| T1 · Tipos compartidos | ✅ Implementado | `bb1e585` |
| T2 · Modelo Prisma | ✅ Implementado | `957ab49` |
| T3 · Persistencia (TOR-01) | ✅ Implementado | `049b8be` |
| T4 · Creación (tipo, identidad, capacidad) | ✅ Implementado | `3a01a16` |
| T5 · Inscripción (titulares/suplentes) | ✅ Implementado | `51df341` |
| T6 · Sorteo + auditoría | ✅ Implementado | `cdf00c9` |
| T7 · Repesca por suplente | ✅ Implementado | `ca5a732` |
| T8 · Recuperación tras reinicio | ✅ Implementado | `6838fd8` |
| T9 · Formulario web | ✅ Implementado | `546bbcb` |
| T10 · Inscripción web (manual + código) | ⏳ Pendiente | — |
| T10b · Autoinscripción por enlace (API + página) | ⏳ Pendiente; no estaba en el plan original | — |
| T11 · Sorteo y auditoría (web) | ⏳ Pendiente | — |
| T12 · Cuadro en vivo (web) | ⏳ Pendiente | — |
| T13 · Repesca (web) | ⏳ Pendiente | — |

**Evidencia:** 246 pruebas del servidor en verde y `typecheck` limpio en server y web al cerrar T9. El backend (T1–T8) está completo y persistido; falta toda la capa web de operación (T10–T13) y la autoinscripción.

### Hallazgo abierto: la inscripción por enlace no existe todavía

El plan asumía que la autoinscripción por enlace/código ya estaba soportada. En realidad solo existe el alta manual (`addParticipant` con token de admin). Falta:

- `POST /api/tournaments/:id/join` sin token de admin (valida torneo en `setup`, cupo de titulares y pasa el excedente a suplentes).
- Una página pública de inscripción (equivalente a `unirse_batalla`), que muestre el nombre y el organizador del torneo.
- Decidir si la inscripción requiere nombre obligatorio y cuenta opcional (regla común de DEC-004).

Hasta entonces, el formulario de T9 permite dejar el campo de participantes vacío, pero ese torneo no puede llenarse desde la web. Por eso T10 se limita a mostrar el código/enlace de administración y a cargar participantes a mano.

## Global Constraints

- No exponer `.env` ni credenciales; commitear y pushear al terminar cada tarea.
- Pruebas que crean/eliminan registros → base descartable (`freestyle-audit-postgres`).
- El web no tiene runner de tests aún (DX-01); las tareas de frontend se verifican con `pnpm --filter @freestyle/web typecheck` + recorrido manual.
- Preservar los cambios existentes del usuario.

## Orden y dependencias

```
T1 (tipos compartidos) → T2 (modelo Prisma) → T3 (persistencia TOR-01)
T4 (creación) → T5 (inscripción) → T6 (sorteo+auditoría) → T7 (suplentes) → T8 (recuperación)
T9 (form) → T10 (inscripción UI) → T10b (autoinscripción) → T11 (sorteo UI) → T12 (cuadro en vivo) → T13 (repesca UI)
```

---

## T1 — Tipos compartidos de torneo ✅

**Files:** `packages/shared/src/types.ts`

**Interfaces:** ampliar `Tournament` con `logo?`, `organizer?`, `capacity`, `suplentes`, `auditLog`.

- [x] **Paso 1 — Implementar**: añadir los campos al tipo `Tournament` (logo/organizador opcionales; `capacity: 4|8|16`; `suplentes: TournamentParticipant[]`; `auditLog: TournamentAuditEntry[]`).
- [x] **Paso 2 — Verificar**: `pnpm --filter @freestyle/server typecheck`.
- [x] **Paso 3 — Commit**: `bb1e585` `feat(shared): ampliar contrato de torneo (identidad, capacidad, suplentes, auditoría)`.

## T2 — Modelo Prisma de torneo ✅

**Files:** `apps/server/prisma/schema.prisma`

**Interfaces:** modelo `Tournament` (id, name, logo?, organizer?, type, capacity, status, adminToken, data JSON, createdAt/updatedAt).

- [x] **Paso 1 — Implementar**: añadir el modelo (guardar el estado en un campo `data Json` para iterar rápido; las fases/resultados viven ahí).
- [x] **Paso 2 — Migrar**: `prisma migrate dev --name add_tournament` (`20261125163358_add_tournament`). El `adminToken` se agregó después en `20261125164406_add_tournament_admin_token`.
- [x] **Paso 3 — Commit**: `957ab49` `feat(server): modelo de torneo en Prisma`.

## T3 — Persistencia y recuperación (TOR-01) ✅

**Files:** `apps/server/src/rooms/tournamentPersistence.ts`, `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `TournamentPersistence` con `create`, `update`, `loadActive`; el manager persiste en cada mutación.

- [x] **Paso 1 — Test que falla**: crear un torneo, guardarlo, leerlo y verificar que `loadActive` lo devuelve.
- [x] **Paso 2 — Implementar**: `TournamentPersistence` (patrón de `BattlePersistence`, con cola de escritura por torneo para evitar que `update` gane a `create`).
- [x] **Paso 3 — Ejecutar** → PASS.
- [x] **Paso 4 — Commit**: `049b8be` `feat(server): persistencia de torneos (TOR-01)`.

## T4 — Creación (tipo, identidad, capacidad) ✅

**Files:** `apps/server/src/rooms/tournamentRoom.ts`, `apps/server/src/index.ts`

**Interfaces:** `createTournament` acepta `type` (sin `king_of_the_hill`), `name`, `logo?`, `organizer?`, `capacity` (4/8/16) y devuelve `null` si la entrada no es válida.

- [x] **Paso 1 — Test que falla**: validar capacidad (rechaza 3/7/9) y tipo (rechaza `king_of_the_hill`).
- [x] **Paso 2 — Implementar**: validación y campos nuevos; `POST /api/tournaments` acepta el cuerpo ampliado.
- [x] **Paso 3 — Ejecutar** → PASS.
- [x] **Paso 4 — Commit**: `3a01a16` `feat(server): creación de torneo con tipo, identidad y capacidad`.

## T5 — Inscripción (titulares y suplentes) ✅

**Files:** `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `addParticipant` mantiene titulares (primeros `capacity`) y suplentes (resto) en orden de inscripción.

- [x] **Paso 1 — Test que falla**: inscribir `capacity + 2` participantes → `capacity` titulares y 2 suplentes.
- [x] **Paso 2 — Implementar**.
- [x] **Paso 3 — Ejecutar** → PASS.
- [x] **Paso 4 — Commit**: `51df341` `feat(server): inscripción con titulares y suplentes`.

## T6 — Sorteo, reorden y auditoría ✅

**Files:** `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `sortParticipants()` (aleatorio) y `reorderParticipants()` que registran en `auditLog`.

- [x] **Paso 1 — Test que falla**: sortear y reordenar registran entradas en `auditLog` con actor y acción.
- [x] **Paso 2 — Implementar**.
- [x] **Paso 3 — Ejecutar** → PASS.
- [x] **Paso 4 — Commit**: `cdf00c9` `feat(server): sorteo y reorden con auditoría`.

## T7 — Sustitución por suplente ✅

**Files:** `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** `substituteParticipant(absentId)` reemplaza al ausente por el siguiente suplente y registra la sustitución.

- [x] **Paso 1 — Test que falla**: sustituir a un titular ausente → el suplente toma su puesto y se registra en `auditLog`.
- [x] **Paso 2 — Implementar**.
- [x] **Paso 3 — Ejecutar** → PASS.
- [x] **Paso 4 — Commit**: `ca5a732` `feat(server): repesca por suplentes`.

## T8 — Recuperación tras reinicio ✅

**Files:** `apps/server/src/index.ts`, `apps/server/src/rooms/tournamentRoom.ts`, `apps/server/src/rooms/tournamentPersistence.ts`

**Interfaces:** `loadTournamentsFromDb()` restaura torneos activos junto con su `adminToken`.

- [x] **Paso 1 — Test que falla**: cargar torneos activos desde la persistencia con su token.
- [x] **Paso 2 — Implementar** (llamado en `index.ts` al arrancar, en paralelo con la recuperación de batallas).
- [x] **Paso 3 — Ejecutar** → PASS.
- [x] **Paso 4 — Commit**: `6838fd8` `feat(server): recuperación de torneos (TOR-01)`.

## T9 — Formulario de creación (web) ✅

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** tipo primero, nombre + logo/organizador opcionales, capacidad; campo de participantes vacío + «Cargar ejemplo»; sin Rey de la pista.

- [x] **Paso 1 — Implementar**.
- [x] **Paso 2 — Verificar**: `pnpm --filter @freestyle/web typecheck` + recorrido manual pendiente.
- [x] **Paso 3 — Commit**: `546bbcb` `feat(web): formulario de torneo (tipo, identidad, capacidad)`.

## T10 — Inscripción (web) ⏳

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** enlace de invitación (solo si T10b existe) + agregar a mano + confirmar titulares/suplentes (A13) + visor de auditoría básico.

- [ ] **Paso 1 — Implementar**: mostrar código/enlace del torneo, alta manual con el endpoint existente y lista separada de titulares y suplentes.
- [ ] **Paso 2 — Verificar**: typecheck + manual.
- [ ] **Paso 3 — Commit**: `feat(web): inscripción manual y código de torneo`.

> Nota: el enlace público de inscripción depende de T10b.

## T10b — Autoinscripción por enlace ⏳ (añadida el 25 de noviembre de 2026)

**Files:** `apps/server/src/index.ts`, `apps/server/src/rooms/tournamentRoom.ts`, `apps/web/src/app/tournament/join/page.tsx` (nuevo)

**Interfaces:** `POST /api/tournaments/:id/join` sin token de admin; página pública que muestra nombre/organizador y confirma la inscripción.

- [ ] **Paso 1 — Test que falla**: inscribir por enlace respeta `setup`, capacidad y suplentes; rechaza torneos iniciados.
- [ ] **Paso 2 — Implementar** endpoint + página.
- [ ] **Paso 3 — Ejecutar** → PASS y typecheck.
- [ ] **Paso 4 — Commit**: `feat: autoinscripción de torneo por enlace`.

## T11 — Sorteo y revisión con auditoría (web) ⏳

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** «Sortear» separado de «Iniciar»; reorden con flechas; visor de auditoría.

- [ ] **Paso 1 — Implementar**.
- [ ] **Paso 2 — Verificar**: typecheck + manual.
- [ ] **Paso 3 — Commit**: `feat(web): sorteo revisable con auditoría`.

## T12 — Cuadro en vivo (web) ⏳

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** panel «Ahora / Después», cuadro actualizado en vivo, retorno a la misma sala.

- [ ] **Paso 1 — Implementar**.
- [ ] **Paso 2 — Verificar**: typecheck + manual.
- [ ] **Paso 3 — Commit**: `feat(web): cuadro en vivo y panel ahora/después`.

## T13 — Repesca (web) ⏳

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** marcar ausencia y sustituir por suplente (visible para todos).

- [ ] **Paso 1 — Implementar**.
- [ ] **Paso 2 — Verificar**: typecheck + manual.
- [ ] **Paso 3 — Commit**: `feat(web): repesca por suplentes`.

---

## Orden recomendado de ejecución

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 (backend, TDD) · T9 → T10 → T10b → T11 → T12 → T13 (web).

Cada tarea es independiente en su ciclo de test; se commitea y pushea al terminar.
