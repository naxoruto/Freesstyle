# Plan de implementación — Batalla individual (Fase 1)

> **For agentic workers:** implementar tarea por tarea, en orden. Cada tarea termina con commit + push (regla de `AGENTS.md`).

> **Progreso (25 de noviembre de 2026):** T1–T11 y pulido (C7/C11/C12/C15) completados. Resta T12 (refactor de la página de batalla).

**Goal:** Rediseñar el recorrido 1vs1: elección de tipo, pantalla única de creación con presets, modalidad Exhibición, lobby claro y cierre con revancha/repetir.

### Seguimiento de revisión manual — 26/11/2026

Cambios solicitados e implementados: copia sin desplazamiento; formato en modal; host opcional y control explicado; MC presenciales sin dispositivo; gestión visual mediante tarjetas con emojis; invitación superior unificada. Se reutiliza `Dialog` también en la cartelera. Reglas detalladas en [especificación §13](../specs/batalla-individual.md). Pruebas unitarias y comprobaciones estáticas/compilación; falta recorrido visual y comprobación de persistencia con PostgreSQL disponible.

**Architecture:** Next.js (web) + Express/Socket.IO (server) + `@freestyle/shared` (contratos). Los cambios de configuración viven en `shared`; el servidor los aplica; la web los presenta.

**Tech Stack:** TypeScript, React 18, Next.js 14, Prisma/PostgreSQL, Socket.IO, vitest (server).

**Spec:** [batalla-individual.md](../specs/batalla-individual.md)

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

## Revisión de jueces — plan de implementación, 27/11/2026

**Objetivo:** integrar los métodos individuales y la vista de juez aprobada, con preparación previa, persistencia y un único veredicto por juez al finalizar.

**Arquitectura prevista:** extraer cálculo puro y validaciones a módulos pequeños; orquestar las acciones de jueces mediante la cola por sala existente. Añadir un estado versionado y persistido de preparación/planillas/veredictos; mantener una ruta explícita para salas antiguas sin ese estado. La UI consume el método del juez autenticado y reutiliza el catálogo compartido.

**Estado:** diseño y reglas principales aprobados; todos los bloques de implementación están pendientes. No reiniciar tareas históricas T1–T11. Confirmadas la edición de rondas anteriores hasta el voto final y la acción «Confirmar planilla». La ampliación de visibilidad/entrega de veredicto requiere las precisiones indicadas en JV-07 antes de conectar su difusión.

**Restricciones comunes:** FMS 0–4 en pasos de 0,5; por rondas 0–10 enteros; mayoría absoluta; réplicas solo mientras estén permitidas; todo cambio crítico confirmado en BD antes de publicar. Consultar `docs/ENTORNO_LOCAL.md`: las pruebas de persistencia requieren PostgreSQL descartable. Respaldar y comprobar restauración antes de migrar una base existente; no ejecutar seeds, resets ni migraciones automáticas desde el lanzador. No copiar el HTML de maqueta a producción.

### Dependencia de producto añadida el 28/11 — configuración por ronda

Antes de ejecutar los bloques JV, reconciliar sus contratos con el [rediseño por ronda](../brainstorming/01-batalla-individual.md#intercambio-patrones-y-contenido--ampliación-del-2811): intercambio, patrones y contenido independientes por ronda, con las restricciones confirmadas de 4x4 y 16x16. Se confirma un minuto por intervención de 16x16 en orden A → B → B → A (cuatro minutos de rap). Se confirma 12x12 con 30 segundos por intervención alternando A → B → A → B…, sin la inversión de la vuelta del 16x16. Se aprueba el orden definitivo de cada ronda: Contenido → Intercambio → Cantidad de patrones. Reconciliar la interfaz y las validaciones con ese orden, que sustituye la elección inicial de patrones antes del formato. Se mantiene confirmado que en 4x4, 8x8 y 12x12, N patrones son N intervenciones por MC, alternadas (3 → A/B/A/B/A/B). Mantener la excepción del 16x16 ya descrita. Se confirma mantener los formatos incompatibles visibles y deshabilitados, con explicación del requisito (por ejemplo, mínimo 3 patrones en 4x4). No cambiar automáticamente la cantidad elegida para habilitarlos. FMS siempre puntúa cada patrón por separado, con 6 casillas dentro de cada minuto del 16x16: 12 por MC en la ronda A → B → B → A, más Escena y Flow una vez por MC para toda la ronda. No igualar automáticamente intervenciones configuradas y patrones puntuables ni usar una nota global por minuto. Se confirma 12x12 con 3 casillas por intervención de 30 segundos: 3 × N por MC con N intervenciones, más Escena/Flow una vez por MC para toda la ronda. Se confirma 8x8 con 2 casillas por intervención: 2 × N por MC con N intervenciones, más Escena/Flow una vez por MC y ronda. Se confirma 4x4 con 1 casilla por intervención: N casillas por MC con N intervenciones, más Escena/Flow una vez por MC y ronda. Queda completo el mapa FMS de casillas por intervención: 4x4 → 1, 8x8 → 2, 12x12 → 3 y 16x16 → 6. El tratamiento de un formato ya seleccionado que se invalida al cambiar la cantidad sigue por precisar. Random Mode y Hard Mode están permitidos en 4x4, 8x8, 12x12 y 16x16, según la corrección del usuario. Contemplar estos modos y la parte a capella de Deluxe en reloj/conceptos y presentación, preservando salas previas. Con imagen es futuro. Los ejemplos de contratos que siguen no incorporan todavía este rediseño completo; no resolver esas dudas mediante supuestos de implementación.

### JV-01 — Cálculo puro y contratos compartidos

**Archivos:** crear `packages/shared/src/judgeVoting.ts`, `apps/server/src/scoring/judgeVoting.ts` y `apps/server/src/scoring/judgeVoting.test.ts`; exportar contratos desde `packages/shared/src/index.ts`. Mantener `scoring.ts` para históricos y voto de sala.

**Interfaces a introducir:**

```ts
export type JudgeMethod = "fms_classic" | "round_wins" | "round_total" | "free";
export type JudgeVerdict = "mc1" | "mc2" | "replica";
export interface FmsRoundGrade {
  patterns: (number | null)[];
  scene: number | null;
  flow: number | null;
}
export type AutomaticVerdict = JudgeVerdict | "needs_free_vote";
// Exportadas desde el módulo de cálculo del servidor:
export function sumFmsRound(grade: FmsRoundGrade): number | null;
export function resolveTotals(mc1: number, mc2: number, canReplica: boolean): AutomaticVerdict;
export function resolveRoundWins(rounds: { mc1: number; mc2: number }[], canReplica: boolean): AutomaticVerdict;
export function resolveCommittee(votes: JudgeVerdict[], canReplica: boolean): JudgeVerdict;
```

- [ ] Escribir y ejecutar pruebas de las reglas: 4x4 con cuatro intervenciones por MC → cuatro casillas puntuables por MC; con todas las notas en 4, total 24 incluyendo Escena y Flow al máximo; 0 válido y celda vacía incompleta; rechazar negativos, >4 y pasos como 0,25; rechazar 7,5 en notas por ronda; empates internos no dan victorias.
- [ ] Verificar el 16x16 completo: 6 casillas por minuto, 12 por MC al incluir ida y vuelta; Escena y Flow una vez para toda la ronda, máximo 56 por MC. Validar según patrones puntuables, sin limitar a una casilla porque el configurador marque 1.
- [ ] Verificar 12x12 con 3 casillas por intervención: con 3 intervenciones por MC, 9 casillas por MC y máximo 44 puntos incluyendo Escena/Flow una vez; no confundir entradas configuradas con casillas puntuables.
- [ ] Verificar 8x8 con 2 casillas por intervención: con 3 intervenciones por MC, 6 casillas por MC y máximo 32 puntos incluyendo Escena/Flow una vez.
- [ ] Cubrir diferencias entre subcategorías y veredictos sin réplicas con estos casos:

```ts
expect(resolveRoundWins([{ mc1: 8, mc2: 7 }, { mc1: 8, mc2: 7 }, { mc1: 0, mc2: 10 }], true)).toBe("mc1");
expect(resolveTotals(16, 24, true)).toBe("mc2");
expect(resolveTotals(24, 24, false)).toBe("needs_free_vote");
expect(resolveCommittee(["mc1", "mc1", "mc2", "mc2", "replica"], true)).toBe("replica");
expect(resolveCommittee(["mc1", "mc1", "mc1", "mc2", "replica"], true)).toBe("mc1");
```

- [ ] Implementar sumas y validaciones sin dependencias de Socket.IO/Prisma. El voto de sala mantiene su propio cálculo; `resolveCommittee` valida 1/3/5 veredictos completos y rechaza `replica` cuando no está permitida. El desempate automático aplica:

```ts
if (mc1 > mc2) return "mc1";
if (mc2 > mc1) return "mc2";
return canReplica ? "replica" : "needs_free_vote";
```

- [ ] Ejecutar desde `apps/server`: `.\node_modules\.bin\vitest.cmd run src/scoring/judgeVoting.test.ts src/scoring/scoring.test.ts`; deben pasar ambas suites, sin BD.
- [ ] Revisar el diff y commitear como `feat(scoring): add individual judge verdict rules`.

### JV-02 — Persistencia versionada y recuperación

**Archivos:** modificar `packages/shared/src/judgeVoting.ts`, `packages/shared/src/types.ts`, `apps/server/prisma/schema.prisma`, `apps/server/src/rooms/battlePersistence.ts`; añadir migración aditiva y pruebas en `apps/server/src/rooms/battlePersistence.test.ts`.

**Contrato persistido:** añadir `judgeVoting` opcional a `Battle`, con un snapshot versionado. Una sala sin este snapshot conserva el recorrido anterior. El snapshot tendrá `version`, `formatRevision` y un registro por `judgeId` con `method`, `readyRevision`, planillas por ronda y veredicto por fase normal/réplica. `null` representa notas sin completar; no convertirlas en cero.

- [ ] Añadir prueba de ida/vuelta que escriba una planilla con `0`, `0.5` y `null`, recupere el método y no intercambie los MC después de elegir el primer turno.
- [ ] Crear migración que añada únicamente un campo JSON nullable a `LiveBattle` para el snapshot, sin reescribir votos/resultados históricos. Extender ambos serializadores (`serializeBattle` y `serializeBattleUpdate`) y `deserializeBattle`.
- [ ] Crear operaciones durables mediante `enqueueBattleWrite` y transacción; copiar el snapshot antes de esperar. Un fallo conserva la última versión válida y no publica el cambio.
- [ ] Añadir pruebas de rechazo de escritura, reconexión y reinicio para configuración, preparación, notas y veredictos. Recargar una batalla iniciada la conserva pausada; los MC presenciales no necesitan sesión digital.
- [ ] En la base descartable, ejecutar migraciones y `.\node_modules\.bin\vitest.cmd run src/rooms/battlePersistence.test.ts src/rooms/battleRecovery.test.ts` desde `apps/server`. Esperar recuperación idéntica y ninguna pérdida de históricos.
- [ ] Revisar migración y secretos; commit `feat(persistence): store versioned judge voting snapshots`.

### JV-03 — Preparación, permisos y bloqueo al iniciar

**Archivos:** modificar `packages/shared/src/types.ts`, `apps/server/src/security/socketPayload.ts`, `apps/server/src/rooms/battleRoom.ts`, `apps/server/src/index.ts`; ampliar `battleRoom.test.ts` y `socketPayload.test.ts`.

**Eventos:** `judge:set_method` recibe `{ method: JudgeMethod }`; `judge:set_ready` recibe `{ formatRevision: number }`. El servidor identifica al juez mediante su sesión y no acepta un `judgeId` arbitrario en el payload. Cada operación entra por la cola de sala y persiste antes de emitir `battle:state`.

- [ ] Escribir pruebas de método independiente para dos jueces, rechazo de un espectador, invalidación de preparación individual al cambiar método y global al modificar formato. Cubrir confirmación enviada para una revisión anterior:

```ts
// Contrato de preparación: solo corresponde a la revisión que el juez vio.
const isReady = judge.readyRevision === snapshot.formatRevision;
// Iniciar exige que todos los jueces estén conectados, tengan método y estén listos.
```

- [ ] Implementar elección por juez antes de comenzar, restablecer su `readyRevision` al cambiar método y aumentar `formatRevision` cuando cambie el formato. Altas de jueces comienzan sin método ni confirmación.
- [ ] Hacer que `battle:start` valide todos los requisitos vigentes más la preparación en la misma acción serializada. No activar ningún temporizador antes de que el organizador inicie. Rechazar cambios voluntarios de método cuando la batalla ya comenzó.
- [ ] Mantener Exhibición sin jueces y el voto de sala separados de este requisito de jueces. Desconectar a un juez durante preparación bloquea el inicio; no sustituirlo ni reducir la mesa silenciosamente.
- [ ] Ejecutar `.\node_modules\.bin\vitest.cmd run src/rooms/battleRoom.test.ts src/security/socketPayload.test.ts`; esperar rechazo de confirmaciones obsoletas y de cambios de método durante la batalla.
- [ ] Commit `feat(battle): require individual judge readiness before countdown`.

### JV-04 — Notas, cierre de batalla y réplicas

**Archivos:** modificar `apps/server/src/rooms/battleRoom.ts`, `apps/server/src/index.ts`, `apps/server/src/security/socketPayload.ts`, `packages/shared/src/judgeVoting.ts`; ampliar pruebas unitarias y de recuperación.

**Edición aprobada:** el juez puede corregir notas de rondas anteriores durante la batalla hasta emitir su voto final. No bloquear una ronda solo porque cambió el turno/ronda actual. Cubrir que el total se recalcula al modificar una nota anterior y que no se cuenta un borrador como voto final.

**Cierre aprobado:** al finalizar, «Confirmar planilla» cierra las notas completas y activa el cálculo automático del voto. Guardar un borrador no equivale a votar. Si el cálculo devuelve `needs_free_vote`, solicitar la elección MC1/MC2 antes de agregar el voto definitivo de ese juez al comité. Cubrir doble confirmación, planilla incompleta y fallo de almacenamiento sin publicar un veredicto.

**Interfaz de evaluación:** un juez de FMS acumula tablas por ronda; `round_wins` acumula victorias; `round_total` suma notas; `free` recibe una elección al cierre. Los cálculos puros de JV-01 generan el veredicto de los métodos con notas; el juez no puede reemplazarlo manualmente salvo `needs_free_vote`.

- [ ] Cubrir una mesa mixta FMS/por rondas/libre con un único voto de igual peso por juez y un único resultado después de todas las rondas. Las rondas intermedias no deciden ganador de batalla ni disparan réplicas.
- [ ] Introducir los eventos de notas conforme al permiso de edición confirmado en el punto anterior; validar valores, número de patrones, rango de ronda, participante real de la sala y método del juez autenticado. No aceptar notas del método de otro juez.
- [ ] Esperar planillas completas antes de resolver un voto automático. Persistir notas y veredictos, y calcular el resultado final con `resolveCommittee` en la cola existente.
- [ ] En cada réplica forzar voto libre efectivo para todos; conservar el método original para trazabilidad. Usar la clave `(sala, réplica, juez)` para no mezclar resultados; rechazar un voto de otra réplica o un segundo voto final ya confirmado.
- [ ] Cubrir el último cupo de réplica, voto de réplica fuera de límite, empate FMS sin cupo → voto libre obligatorio, mayoría 2/3 y 3/5 y fallo de persistencia antes de publicar.
- [ ] Ejecutar las pruebas unitarias de JV-01/JV-03 y las de recuperación sobre base descartable. Commit `feat(battle): resolve mixed judge methods at battle close`.

### JV-05 — Integrar las tres vistas aprobadas con componentes compartidos

**Archivos nuevos de dominio:** `apps/web/src/components/judge/JudgeWorkspace.tsx`, `FmsJudgeSheet.tsx`, `RoundJudgeSheet.tsx`, `FreeJudgeBallot.tsx`. Modificar `apps/web/src/app/battle/[id]/page.tsx`, `apps/web/src/components/BattleLobby.tsx`, `BattleModeSelector.tsx` y `docs/producto/GUIA_COMPONENTES_UI.md`.

**Contrato UI:** `JudgeWorkspace` recibe la batalla, el estado del juez autenticado y callbacks de notas/veredicto implementados en JV-03/JV-04. Los componentes no acceden directamente a Prisma ni crean sockets propios. Extraer el estado del juez en el orquestador y pasarlo por props; los controles de presentación no deciden permisos.

- [ ] Revisar primero el catálogo. Reutilizar `Timer`, `WordDisplay`, `Button`, `TextField`, `Panel`, `Alert` y `Dialog`; crear solo las composiciones de juez que no existen.
- [ ] Llevar el selector de método a la preparación individual; conservar en «Editar formato» tiempos, entradas, rondas y conceptos. Mostrar «Estoy listo» y el estado de cada juez al organizador.
- [ ] Implementar FMS con tabla de la ronda actual y acceso a anteriores; diferenciar casilla sin nota de una nota cero y aceptar pasos de 0,5. En móvil, distribuir casillas por MC como en la maqueta.
- [ ] Implementar ambas subcategorías por rondas con la misma tabla y distinto resumen; notas enteras de 0 a 10 y explicación visible de la subcategoría bloqueada.
- [ ] Implementar voto libre al cierre con selección y confirmación. Durante la batalla mostrar contexto y espera; en réplicas añadir la opción de otra réplica solo si el servidor la autoriza. No mostrar elección manual de ganador donde corresponda cálculo automático.
- [ ] Mostrar errores y estado confirmado por servidor; no anunciar «Guardado» o «Voto enviado» únicamente por emitir un evento. Conservar borradores al perder conexión y reconciliar con la versión persistida antes de habilitar edición.
- [ ] Desde `apps/web`, ejecutar `.\node_modules\.bin\eslint.cmd . --max-warnings=0` y `.\node_modules\.bin\next.cmd build`; después del build, ejecutar `.\node_modules\.bin\tsc.cmd --noEmit`. No ejecutar build y typecheck en paralelo porque ambos usan `.next/types`.
- [ ] Recorrer FMS, ambas subcategorías y libre en escritorio y móvil; comprobar foco, teclado, zoom, tablas, reloj visible, botones compactos y ausencia de saltos al copiar/abrir modales. Commit `feat(web): integrate individual judge workspace`.

### JV-06 — Recorrido integrado y cierre de documentación

**Archivos:** actualizar el registro de producto, este plan y el catálogo UI con evidencias reales; ampliar `apps/server/src/rooms/battleRecovery.test.ts` si el recorrido descubre casos no cubiertos.

- [ ] Preparar una base descartable según `docs/ENTORNO_LOCAL.md`. Probar migración desde una copia de la estructura anterior y recuperación de una sala antigua sin snapshot; no usar la base real para registros de prueba.
- [ ] Recorrer organizador + dos MC presenciales + tres jueces con métodos distintos. Elegir métodos, marcar listos, cambiar formato y confirmar que el inicio se bloquea hasta que todos reconfirmen.
- [ ] Completar varias rondas, verificar un voto por juez al cierre y repetir un caso sin mayoría. Agotar las réplicas y comprobar que no se puede emitir otro voto de réplica.
- [ ] Reiniciar el servidor durante preparación, una ronda y el cierre; comprobar notas/métodos persistidos, pausa recuperable, permisos y ausencia de veredictos duplicados.
- [ ] Ejecutar pruebas de scoring, sala, validación, persistencia y recuperación, typecheck y builds. Añadir resultados reales al plan; no registrar los casos pendientes como comprobados.
- [ ] Revisar cambios por secretos, solicitar revisión de código, resolver bloqueos, commitear y subir a la rama configurada.

### JV-07 — Visibilidad autorizada y entrega del veredicto

**Archivos:** crear `apps/server/src/rooms/battleViews.ts` y `battleViews.test.ts`; modificar contratos compartidos, serialización/persistencia y puntos de emisión en `apps/server/src/index.ts`; añadir controles a la configuración de batalla y consumo de vistas autorizadas en la web.

**Producto confirmado:** dos ajustes independientes: votación en vivo/privada y veredicto solo al host/en pantallas de todos. En vivo permite al público ver votos de jueces, excluyendo a los MC que compiten. En ambos modos de entrega debe existir consulta del desglose por juez.

**Alcance en vivo confirmado:** el público ve las notas ingresadas/corregidas durante la batalla y los votos finales confirmados de cada juez. Distinguir estados provisionales y definitivos y mantener la exclusión de MC que compiten.

**Resumen privado confirmado:** después del anuncio, todas las personas pueden ver únicamente el ganador y el veredicto emitido por cada juez. Mantener las notas y tablas privadas fuera de ese resumen público.

**Anuncio del host confirmado:** en modo solo host, «Veredicto anunciado» habilita para el resto el resumen del ganador y los votos individuales. Persistir el estado de publicación antes de difundirlo; no confundir entrega privada al host con publicación general.

**Organizador como anunciante, aprobado:** si no se asignó host desde el principio, o si el host se desconecta antes del anuncio, el organizador puede recibir el veredicto y ejecutar «Veredicto anunciado». La publicación continúa siendo explícita y conserva el resumen/privacidad configurados. No exigir un host para seleccionar anuncio manual.

**Independencia aprobada:** cada juez ve solo sus propias notas hasta confirmar su voto final; ocultar notas y votos de otros jueces incluso en modo en vivo. Tras confirmar, aplicar la política de publicación sin abrir las tablas privadas. Probar la restricción también cuando comparte otros roles.

**Valor inicial aprobado:** nuevas batallas en «Voto secreto» (privado); el organizador puede elegir votación en vivo durante la configuración previa al inicio. Mantener independiente el selector de entrega del veredicto.

**Entrega predeterminada aprobada:** mostrar automáticamente el ganador a todos cuando se resuelve el resultado final, con consulta de votos individuales. El organizador puede elegir anuncio manual del host/organizador antes de empezar. Mantener independientes esta opción y el voto secreto/en vivo.

- [ ] Añadir políticas persistidas y versionadas al snapshot de JV-02, diferenciadas del método individual de cada juez. No reutilizar el booleano global forzado como única regla de privacidad.
- [ ] Probar que una batalla nueva empieza con voto secreto y que seleccionar en vivo antes de iniciar cambia esa política sin alterar la forma de entrega del veredicto. La adopción del valor inicial no reconfigura silenciosamente salas históricas activas.
- [ ] Probar que la entrega inicial es automática para todos y que el anuncio manual sigue disponible. Con voto secreto, el resumen final permite consultar ganador y votos individuales, sin revelar notas ni tablas; la opción de entrega no altera la privacidad.
- [ ] Crear una función de proyección de estado/resultados que reciba identidad y roles autenticados del destinatario. Probar público, ambos MC, juez, organizador y host, incluyendo personas con múltiples roles. La exclusión de MC en el modo en vivo debe respetarse.
- [ ] Probar dos jueces antes y después de confirmar: ninguno recibe notas/votos ajenos antes de su voto final, aunque el público sí los vea en vivo. Un juez con rol adicional no puede eludir la restricción. En modo privado no se revelan tablas ajenas después de confirmar.
- [ ] Aplicar las proyecciones a `battle:state`, resultados/veredictos, entrada/reconexión, consultas HTTP e históricos consultables. Mantener las notas editables privadas de su autor salvo lo expresamente aprobado en la política.
- [ ] En modo en vivo, probar que una nota modificada de una ronda anterior se actualiza para el público tras persistirse y que el voto final solo figura como confirmado después del cierre correspondiente. No confundir una nota pública provisional con un veredicto ya emitido.
- [ ] En modo solo host, entregar a ese destinatario el veredicto y aplicar al resto la vista aprobada para el periodo previo al anuncio. Probar que los payloads restringidos no contienen el ganador ni datos ocultos mediante otro evento o endpoint.
- [ ] Validar «Veredicto anunciado» por identidad/permiso del host autorizado o del organizador que lo reemplaza por desconexión, y solo cuando exista un resultado definitivo. El servidor comprueba la desconexión; no confiar en un flag enviado por el cliente. Persistir la publicación y emitir después las vistas correspondientes; cubrir pulsaciones repetidas y recuperación del estado tras reconectar.
- [ ] Probar host conectado, sala configurada sin host, desconexión previa al anuncio, reemplazo autorizado por organizador y rechazo a público/jueces sin ese permiso. La ausencia/desconexión por sí sola no publica el resultado.
- [ ] En modo privado, verificar que después del anuncio la vista pública contiene ganador y votos individuales, pero no notas, patrones, puntuaciones por ronda ni correcciones. Aplicar el mismo límite en reconexión y consultas del historial.
- [ ] Reutilizar los controles UI existentes para ambos selectores y para consultar el desglose. No presentar el voto privado como un simple filtro visual de datos ya enviados al navegador.
- [ ] Ejecutar pruebas unitarias de proyección sin BD y pruebas de reconexión/persistencia en base descartable; verificar las dos políticas en sesiones independientes de público, MC y host. Commit `feat(battle): enforce vote visibility and verdict delivery`.

**Orden actualizado:** JV-01 → JV-02 → JV-03 → JV-04 → definiciones de visibilidad → JV-07 → JV-05 → JV-06. La integración completa de votos y veredictos requiere JV-07 para respetar las nuevas opciones. El diseño y el plan no equivalen a una implementación terminada.
