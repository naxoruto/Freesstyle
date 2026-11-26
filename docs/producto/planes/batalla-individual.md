# Plan de implementación — Batalla individual (Fase 1)

> **For agentic workers:** implementar tarea por tarea, en orden. Cada tarea termina con commit + push (regla de `AGENTS.md`).

> **Progreso (25 de noviembre de 2026):** T1–T11 y pulido (C7/C11/C12/C15) completados. Resta T12 (refactor de la página de batalla).

**Goal:** Rediseñar el recorrido 1vs1: elección de tipo, pantalla única de creación con presets, modalidad Exhibición, lobby claro y cierre con revancha/repetir.

### Seguimiento de revisión manual — 26/11/2026

Cambios solicitados e implementados: copia sin desplazamiento; formato en modal; host opcional y control explicado; MC presenciales sin dispositivo; gestión visual mediante tarjetas con emojis; invitación superior unificada. Se reutiliza `Dialog` también en la cartelera. Reglas detalladas en [especificación §13](../specs/batalla-individual.md). Pruebas unitarias y comprobaciones estáticas/compilación; falta recorrido visual y comprobación de persistencia con PostgreSQL disponible.

**Architecture:** Next.js (web) + Express/Socket.IO (server) + `@freestyle/shared` (contratos). Los cambios de configuración viven en `shared`; el servidor los aplica; la web los presenta.

**Tech Stack:** TypeScript, React 18, Next.js 14, Prisma/PostgreSQL, Socket.IO, vitest (server).

**Spec:** [batalla-individual.md](../producto/specs/batalla-individual.md)

## Global Constraints

- No exponer `.env` ni credenciales; commitear y pushear al terminar cada tarea.
- Pruebas que crean/eliminan registros → base descartable (`freestyle-audit-postgres`).
- El web no tiene runner de tests aún (DX-01); las tareas de frontend se verifican con `pnpm --filter @freestyle/web typecheck` + recorrido manual.
- Preservar los cambios existentes del usuario.

## Orden y dependencias

```
T1 (variado en shared) → T2 (presets en shared) → T3 (palabra por ronda, server)
T4 (cookie admin) → T5 (sin query params)
T6 (creación UI) → T7 (presets UI) → T8 (lobby invitar+modalidad) → T9 (lobby reglas)
T10 (exhibición) → T11 (cierre)
T12 (WEB-03 + WEB-01)  [enabler, intercalado con T6]
```

---

## T1 — Modo `"variado"` en la configuración compartida

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/battleConfig.ts`
- Test: `apps/server/src/rooms/battleConfig.test.ts`

**Interfaces:**
- Produce: `BattleMode` admite `"clasico" | "libre" | "variado"`; `validateConfig` acepta `"variado"`.

- [ ] **Paso 1 — Test que falla**: en `battleConfig.test.ts`, añadir que `validateConfig` acepte `mode: "variado"` (formato 1x1, countdown, rúbrica).
- [ ] **Paso 2 — Ejecutar**: `pnpm --filter @freestyle/server exec vitest run src/rooms/battleConfig.test.ts` → FAIL.
- [ ] **Paso 3 — Implementar**: ampliar `BattleMode` a `"clasico" | "libre" | "variado"` y la lista de modos válidos en `validateConfig`.
- [ ] **Paso 4 — Ejecutar** → PASS.
- [ ] **Paso 5 — Commit**: `feat(shared): añadir modo "variado" a la configuración de batalla`.

---

## T2 — Presets en la configuración compartida

**Files:**
- Modify: `packages/shared/src/battleConfig.ts`
- Test: `apps/server/src/rooms/battleConfig.test.ts`

**Interfaces:**
- Produce: `BATTLE_PRESETS` (mapa `{ rapida, variado, por_entradas }` → `BattleModeConfig`) y `presetLabel(id)` → resumen legible.

- [ ] **Paso 1 — Test que falla**: verificar que existen 3 presets, que cada uno pasa `validateConfig`, y que `presetLabel("variado")` contiene «alterna libre y con concepto».
- [ ] **Paso 2 — Ejecutar** → FAIL.
- [ ] **Paso 3 — Implementar**:
  - `rapida`: `{ mode:"libre", format:"1x1", rounds:1, timePerTurn:60, timerMode:"countdown", votingSystem:"free_vote", turnStructure:"one_way" }`.
  - `variado`: `{ mode:"variado", format:"1x1", rounds:3, timePerTurn:60, timerMode:"countdown", votingSystem:"rubrica", turnStructure:"one_way" }`.
  - `por_entradas`: `{ mode:"clasico", format:"4x4", rounds:2, timerMode:"manual", entriesPerParticipant:4, votingSystem:"patron", turnStructure:"one_way", liveControlEnabled:true }`.
  - `presetLabel` devuelve el resumen visible de la spec.
- [ ] **Paso 4 — Ejecutar** → PASS.
- [ ] **Paso 5 — Commit**: `feat(shared): definir presets de batalla (rápida, variado, por entradas)`.

---

## T3 — Generación de palabra por ronda para `"variado"`

**Files:**
- Modify: `apps/server/src/rooms/battleRoom.ts` (caso `countdown` de `advancePhase`)
- Test: `apps/server/src/rooms/battleRoom.test.ts`

**Interfaces:**
- Consume: `battle.mode.mode === "variado"`.
- Produce: en `countdown`, para `"variado"` → impar (rondas 1, 3) sin palabra; par (ronda 2) con palabra.

- [ ] **Paso 1 — Test que falla**: iniciar una batalla con `mode:"variado"`, avanzar a `mc1_turn` y verificar `currentWord` es `undefined` en ronda 1; avanzar a ronda 2 y verificar que `currentWord` existe.
- [ ] **Paso 2 — Ejecutar** → FAIL.
- [ ] **Paso 3 — Implementar**: en el caso `countdown`, calcular `useConcept = battle.mode.mode === "clasico" || (battle.mode.mode === "variado" && battle.currentRound % 2 === 0)`. Si no `useConcept`, dejar `currentWord = undefined`.
- [ ] **Paso 4 — Ejecutar** → PASS.
- [ ] **Paso 5 — Commit**: `feat(server): alternar palabra por ronda en modo "variado"`.

---

## T4 — adminToken a cookie httpOnly (SEG-03)

**Files:**
- Modify: `apps/server/src/index.ts` (`POST /api/battles`, `POST /api/tournaments` y acceso)
- Modify: `apps/web/src/app/page.tsx`, `apps/web/src/app/tournament/page.tsx`
- Test: `apps/server/src/index` (vía un test de ruta, o ampliar el contrato)

**Interfaces:**
- Produce: al crear batalla/torneo, el servidor emite cookie `httpOnly` (corta vida) y **omite** `adminToken` del JSON.

- [ ] **Paso 1 — Test que falla**: verificar que la respuesta de creación no incluye `adminToken` y que emite `Set-Cookie`.
- [ ] **Paso 2 — Ejecutar** → FAIL.
- [ ] **Paso 3 — Implementar**: en `index.ts`, usar `res.cookie(...)` y quitar `adminToken` del body; en la web, dejar de leer/escribir `sessionStorage.battle_admin_*` y confiar en la cookie.
- [ ] **Paso 4 — Ejecutar** → PASS + `typecheck` web.
- [ ] **Paso 5 — Commit**: `feat(server): emitir adminToken como cookie httpOnly`.

---

## T5 — Eliminar entrada por query params (SEG-02)

**Files:**
- Modify: `apps/web/src/app/battle/[id]/page.tsx`
- Modify: `apps/web/src/app/tournament/page.tsx`
- Modify: `apps/web/src/app/unirse_batalla/[id]/page.tsx`

**Interfaces:**
- Produce: la entrada se resuelve solo por `inviteToken` (y cookie de admin); se elimina `legacyRole` y la lectura de `alias`/`userId` de la query.

- [ ] **Paso 1 — Verificar**: revisar que no queden `searchParams.get("role"|"alias"|"userId")` ni `alsoAs` en el flujo.
- [ ] **Paso 2 — Implementar**: quitar esos parámetros y el enlace con `?role=...` de `tournament/page.tsx` (sustituir por token de acceso a la sala).
- [ ] **Paso 3 — Verificar**: `pnpm --filter @freestyle/web typecheck` + recorrido manual torneo→batalla.
- [ ] **Paso 4 — Commit**: `feat(web): entrada a sala solo por invitación (sin identidad en URL)`.

---

## T6 — Flujo de creación: elección + pantalla única (WEB-03 habilitador)

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/lib/api.ts` (capa cliente compartida — WEB-03)

**Interfaces:**
- Produce: «Crear batalla» abre elección 1vs1/torneo/rey; 1vs1 muestra pantalla única (AKA + presets + resumen + «Crear») y navega al lobby.

- [ ] **Paso 1 — Crear `lib/api.ts`** con `createBattle(mode)` y `createTournament(...)` tipados (WEB-03).
- [ ] **Paso 2 — Implementar** la elección de tipo y la pantalla única (nickname + presets desde `BATTLE_PRESETS` + resumen + «Crear»).
- [ ] **Paso 3 — Verificar**: `pnpm --filter @freestyle/web typecheck` + crear una sala manualmente.
- [ ] **Paso 4 — Commit**: `feat(web): elección de tipo y pantalla única de creación 1vs1`.

---

## T7 — Presets en la UI del selector

**Files:**
- Modify: `apps/web/src/components/BattleModeSelector.tsx`

**Interfaces:**
- Consume: `BATTLE_PRESETS`, `presetLabel` (de T2).
- Produce: tarjetas de preset con resumen; «Cambiar formato» abre el selector completo; «Personalizado» al desviarse; opciones de tiempo 30/45/60/90/120 (C14).

- [ ] **Paso 1 — Implementar** las tarjetas de preset + toggle «Cambiar formato».
- [ ] **Paso 2 — Implementar** el estado «Personalizado» (comparar config con los presets).
- [ ] **Paso 3 — Verificar**: `typecheck` + recorrido manual.
- [ ] **Paso 4 — Commit**: `feat(web): presets con resumen y estado personalizado`.

---

## T8 — Lobby: bloque invitar + selector de modalidad

**Files:**
- Modify: `apps/web/src/components/BattleLobby.tsx`
- Modify: `apps/web/src/app/battle/[id]/page.tsx`

**Interfaces:**
- Produce: bloque «Invitar» (código + enlace + confirmación en el lobby) y selector «Batalla con jueces / Exhibición».

- [ ] **Paso 1 — Implementar** el bloque invitar unificado (Q2: código y confirmación en el lobby).
- [ ] **Paso 2 — Implementar** el selector de modalidad (con el estado de exhibición por defecto cuando solo hay 2 MC).
- [ ] **Paso 3 — Verificar**: `typecheck` + recorrido manual.
- [ ] **Paso 4 — Commit**: `feat(web): lobby con invitación unificada y selector de modalidad`.

---

## T9 — Lobby: requisitos, mensaje de jueces, rol/permisos, réplica

**Files:**
- Modify: `apps/web/src/components/BattleLobby.tsx`

**Interfaces:**
- Produce: requisitos según modalidad/votación (C9); mensaje «1, 3 o 5 — sobra 1 o falta 1» (C10); separación rol/permisos (C11); resumen real de réplica (C12).

- [ ] **Paso 1 — Implementar** C9 y C10 (cálculo de jueces faltantes/sobrantes).
- [ ] **Paso 2 — Implementar** C11 y C12.
- [ ] **Paso 3 — Verificar**: `typecheck` + recorrido manual.
- [ ] **Paso 4 — Commit**: `feat(web): reglas claras en el lobby (jueces, roles, réplica)`.

---

## T10 — Modalidad Exhibición (servidor + cierre)

**Files:**
- Modify: `apps/server/src/rooms/battleRoom.ts` (`startBattle`: permitir sin jueces en exhibición)
- Modify: `apps/web/src/app/battle/[id]/page.tsx` (cierre sin ganador)
- Test: `apps/server/src/rooms/battleRoom.test.ts`

**Interfaces:**
- Consume: `battle.mode.exhibition` (o flag equivalente) de T8.
- Produce: inicio sin jueces en exhibición; cierre sin ganador ni puntaje.

- [ ] **Paso 1 — Test que falla**: `startBattle` con exhibición y 0 jueces devuelve `{ battle }` (no error).
- [ ] **Paso 2 — Ejecutar** → FAIL.
- [ ] **Paso 3 — Implementar** la validación de exhibición en `startBattle` y el cierre sin ganador en la web.
- [ ] **Paso 4 — Ejecutar** → PASS + `typecheck`.
- [ ] **Paso 5 — Commit**: `feat: modalidad exhibición sin jueces ni ganador`.

---

## T11 — Cierre: Revancha y Repetir formato

**Files:**
- Modify: `apps/web/src/app/battle/[id]/page.tsx`

**Interfaces:**
- Produce: botones «Revancha» (misma config + mismos MC) y «Repetir formato» (misma config, sala vacía), con confirmación.

- [ ] **Paso 1 — Implementar** los dos botones y la confirmación de participantes.
- [ ] **Paso 2 — Verificar**: `typecheck` + recorrido manual.
- [ ] **Paso 3 — Commit**: `feat(web): revancha y repetir formato desde el cierre`.

---

## T12 — Refactor: dividir `battle/[id]/page.tsx` (WEB-01)

**Files:**
- Create: `apps/web/src/app/battle/[id]/hooks.ts` (o `lib/`), subcomponentes (`JudgePanel`, `RoundResultPanel`, `FinishedView`, `RecoveryView`)
- Modify: `apps/web/src/app/battle/[id]/page.tsx`

**Interfaces:**
- Produce: `page.tsx` reducido a orquestador; hooks y subcomponentes reutilizables.

- [ ] **Paso 1 — Extraer** hooks de socket/countdown/timer.
- [ ] **Paso 2 — Extraer** subcomponentes de votación/resultado/cierre.
- [ ] **Paso 3 — Verificar**: `typecheck` + suite server intacta + recorrido manual.
- [ ] **Paso 4 — Commit**: `refactor(web): dividir la página de batalla en hooks y subcomponentes`.

---

## Orden recomendado de ejecución

T1 → T2 → T3 (configuración y modo, backend) · T4 → T5 (seguridad) · T6 → T7 → T8 → T9 (UI) · T10 → T11 (exhibición y cierre) · T12 (refactor final).

Cada tarea es independiente en su ciclo de test; se commitea y pushea al terminar.
