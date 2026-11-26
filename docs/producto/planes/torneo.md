# Plan de implementación — Torneo (Fase 2)

> **For agentic workers:** implementar tarea por tarea, en orden. Cada tarea termina con commit + push (regla de `AGENTS.md`).

**Goal:** Torneo recuperable y claro: creación con reglas, inscripción guiada por enlace/manual, confirmación de titulares, sorteo con auditoría, cuadro en vivo y repesca por suplentes.

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
| T10 · Inscripción guiada y confirmación de titulares | ✅ Implementado | Esta entrega |
| T10b · Autoinscripción por enlace (API + página) | ✅ Implementado | Esta entrega |
| T11 · Sorteo y auditoría (web) | ✅ Implementado | Esta entrega |
| T12 · Cuadro en vivo (web) | ⏳ Pendiente | — |
| T13 · Repesca (web) | ⏳ Pendiente | — |

**Evidencia:** al cerrar T10, 251 pruebas del servidor en verde, lint y typecheck limpios, compilaciones de web y servidor correctas; recorrido HTTP y de navegador con base descartable. T10b agrega el enlace público, la vista individual de inscripción y el cierre efectivo al confirmar. T11–T13 siguen pendientes.

### Hallazgo resuelto: inscripción por enlace

El plan asumía que la autoinscripción por enlace/código ya estaba soportada. T10b incorpora:

- `POST /api/tournaments/:id/join` sin token de admin; valida estado y cierre, y pasa el excedente a suplentes.
- Página pública de inscripción que muestra nombre, organizador y reglas vigentes, con nombre de invitado obligatorio.
- Consulta individual del estado provisional o confirmado; el identificador de la inscripción se guarda en la sesión del navegador.

La vinculación con cuentas queda para la fase de perfil y cuentas (Fase 4). El organizador comparte el enlace desde el paso guiado y conserva el control del torneo al recargar la misma sesión.

**Límite de la inscripción invitada:** el reintento desde la misma sesión usa el mismo identificador y no duplica la plaza; el servidor limita la frecuencia de altas. Sin una identidad verificada, una persona todavía puede usar distintos navegadores o nombres para solicitar varias plazas. El organizador puede quitar esas inscripciones antes de iniciar.

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

## T10 — Inscripción (web) ✅

**Files:** `apps/web/src/app/tournament/page.tsx`, `apps/server/src/index.ts`, `apps/server/src/rooms/tournamentRoom.ts`

**Interfaces:** etapa de inscripción guiada tras crear; reglas de batalla definidas antes de compartir y editables hasta iniciar; agregar a mano, mover y quitar inscritos; confirmar titulares y cerrar inscripción pública (DEC-021). El enlace de invitación funciona con T10b.

- [x] **Paso 1 — Implementar**: configuración de reglas antes de crear, alta manual, listas separadas de titulares y suplentes, controles de mover/quitar, auditoría básica y confirmación que cierra la inscripción pública.
- [x] **Paso 2 — Verificar**: pruebas del servidor, lint/typecheck/build y recorrido HTTP y de navegador con base descartable.
- [x] **Paso 3 — Commit**: `feat(torneo): inscripción guiada y confirmación de titulares`.

> El enlace público de inscripción se entregó en T10b.

## T10b — Autoinscripción por enlace ✅ (añadida el 25 de noviembre de 2026)

**Files:** `apps/server/src/index.ts`, `apps/server/src/rooms/tournamentRoom.ts`, `apps/web/src/app/tournament/join/[id]/page.tsx` (nuevo)

**Interfaces:** `POST /api/tournaments/:id/join` sin token de admin; página pública que muestra nombre/organizador y reglas vigentes, confirma la inscripción y muestra el estado provisional del inscrito. Tras confirmar titulares, no admite nuevas inscripciones públicas (DEC-021).

- [x] **Paso 1 — Test que falla**: inscribir por enlace respeta `setup`, capacidad y suplentes; rechaza inscripciones cerradas; la consulta muestra las reglas vigentes y el estado del inscrito.
- [x] **Paso 2 — Implementar** endpoint + página.
- [x] **Paso 3 — Ejecutar** → 256 pruebas del servidor, lint, typecheck y builds; recorrido HTTP de inscripción pública con base descartable.
- [x] **Paso 4 — Commit**: `feat(torneo): autoinscripción por enlace`.

## T11 — Sorteo y revisión con auditoría (web) ✅

**Files:** `apps/web/src/app/tournament/page.tsx`

**Interfaces:** «Sortear» separado de «Iniciar»; reorden con flechas; visor de auditoría.

- [x] **Paso 1 — Implementar**: separar sorteo del inicio, mostrar el orden, permitir reordenar titulares y mostrar el registro de actividad.
- [x] **Paso 2 — Verificar**: pruebas del servidor, lint, typecheck, compilaciones y recorrido HTTP de sorteo, reorden, auditoría e inicio.
- [x] **Paso 3 — Commit**: `feat(torneo): sorteo revisable con auditoría`.

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
