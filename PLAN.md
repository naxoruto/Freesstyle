# Plan de Trabajo — Freestyle Arena

**Estado actual:** App funcional con catálogo, inventario externo, juego diario, demo 1vs1 y torneos. Este documento queda como backlog de evolución de batalla.

> Nota: varios puntos de esta lista ya existen de forma parcial o completa en el código actual. Se conservan aquí para ordenar el trabajo pendiente y las mejoras de la sala.

---

## Épicas y Tareas

### ÉPICA A — Configuración de Batalla (lobby)
> Dar más control al host/admin antes de empezar.

| # | Tarea | Archivos clave | Complejidad |
|---|-------|----------------|-------------|
| A1 | **Elegir quién parte primero** | `battleRoom.ts`, `types.ts`, `battle/[id]/page.tsx` | S |
| A2 | **Modos de batalla** (incluye modo libre/sin concepto) | `modes.ts`, `wordGenerator.ts`, `types.ts` | S |
| A3 | **Tiempos configurables** (parte de config de modo) | `battleRoom.ts`, `modes.ts` | S |
| A4 | **Modo entradas** (contador de entradas por MC, sin timer) | `modes.ts`, `types.ts`, `battleRoom.ts`, `battle/[id]/page.tsx` | M |
| A5 | **Categorías de palabras** (selección manual + aleatorio) | `wordGenerator.ts`, `types.ts` | S |

#### Especificaciones Épica A

**A1 — Elegir quién parte**
- El HOST (no admin genérico) elige antes de iniciar la batalla
- Opciones: seleccionar MC1 específico, o "aleatorio"
- Si aleatorio → sistema sortea y muestra resultado en lobby antes de comenzar
- Impacto: `Battle.currentTurn` se setea en `startBattle()` según esta elección

**A2 — Modos de batalla**
- `"clasico"` → con concepto/palabra generada, timer por turno
- `"libre"` → sin concepto, el MC rapea sobre lo que quiera; timer sigue igual
- Cada modo es una opción en `BattleMode` type + entrada en `MODE_DEFAULTS`
- El host selecciona el modo en lobby antes de iniciar

**A3 — Tiempos configurables**
- `timePerTurn` es configurable por el host en lobby (ej: 30s, 45s, 60s, 90s, libre)
- Esto es un campo dentro de `BattleModeConfig`, no un modo separado
- Opciones predefinidas + campo custom

**A4 — Modo entradas (aka "4x4 / contador")**
- Nuevo modo: sin timer automático
- Host configura N entradas por MC antes de iniciar (ej: 4, 5, 8...)
- Flujo de turno: MC rapea → host presiona botón "entrada completada" → descuenta contador → repite
- Cuando contador llega a 0 → termina turno de ese MC → pasa al otro
- Razón: las bases tienen distintos tiempos, el host controla manualmente
- `RoundPhase` no cambia; lo que cambia es que el avance de fase es 100% manual
- En `BattleModeConfig`: agregar `entradas?: number` y `timerMode: "countdown" | "manual"`

**A5 — Categorías de palabras**
- Mantener categorías actuales + agregar nuevas (definir cuáles en implementación)
- UI en lobby: opción "aleatorio" (sistema elige) O selección manual de categoría específica
- `BattleModeConfig.category` ya existe como opcional → solo ampliar UI y wordGenerator

---

### ÉPICA B — Roles y Audiencia
> Nuevos roles con permisos diferenciados.

| # | Tarea | Archivos clave | Complejidad |
|---|-------|----------------|-------------|
| B1 | **Observadores / Público** | `battleRoom.ts`, `types.ts`, `battle/[id]/page.tsx`, `page.tsx` | M |
| B2 | **Host** | `battleRoom.ts`, `types.ts`, `battle/[id]/page.tsx` | M |

#### Especificaciones Épica B

**B1 — Observadores (role `spectator`)**
- Ven estado de batalla en tiempo real: fases, timer, concepto/palabra actual
- Ven puntajes de jueces **solo si el host lo permite** (toggle en config de sala)
- No pueden votar ni avanzar fases
- No aparecen en `participants` ni `judges`
- Se unen igual que cualquier otro rol (código de sala + alias)
- Vista propia: pantalla de público, más limpia, sin controles

**B2 — Host (role `host`)**
- Solo puede haber **1 host por sala**
- Controla el flujo de la batalla: avanzar fases, consumir entradas, aprobar réplicas
- Puede ser juez **al mismo tiempo** (útil cuando no hay host dedicado y un juez toma el control)
- El **creador de la sala es admin**, puede transferir el rol de host a otro usuario conectado
- Si no hay host asignado → el admin actúa como host
- Permisos del host: todo lo que hace admin durante la batalla, excepto configurar sala (eso es solo admin en lobby)

**Tabla de permisos por rol:**

| Acción | admin | host | judge | participant | spectator |
|--------|-------|------|-------|-------------|-----------|
| Configurar sala (lobby) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Iniciar batalla | ✅ | ❌ | ❌ | ❌ | ❌ |
| Avanzar fases / entradas | ✅ | ✅ | ❌ | ❌ | ❌ |
| Aprobar réplica | ✅ | ✅ | ❌ | ❌ | ❌ |
| Votar | ❌ | (si también es judge) | ✅ | ❌ | ❌ |
| Pedir réplica | ❌ | ❌ | ❌ | ✅ | ❌ |
| Ver concepto | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver votos en tiempo real | ✅ | ✅ | ✅ | ❌ | si host permite |
| Transferir host | ✅ | ✅ | ❌ | ❌ | ❌ |

---

### ÉPICA C — Sistema de Puntuación
> Dos sistemas de votación + lógica de réplica automática.

| # | Tarea | Archivos clave | Complejidad |
|---|-------|----------------|-------------|
| C1 | **Sistema de votación por patrón (FMS/Red Bull)** | `scoring.ts`, `types.ts`, `RubricPanel.tsx`, `ScoreBoard.tsx`, `battleRoom.ts` | L |
| C3 | **Réplica automática configurable** | `battleRoom.ts`, `types.ts`, `battle/[id]/page.tsx` | L |

#### Especificaciones Épica C

**Dos sistemas de votación — configurables independiente del modo de turno:**

| Sistema | Cuándo se vota | Qué se vota | Escala |
|---------|---------------|-------------|--------|
| `"rubrica"` (actual) | Al final de cada ronda (ambos MCs terminaron) | flow / lírica / ingenio / presencia / técnica | 0–10 c/u |
| `"patron"` (FMS/Red Bull) | Después de **cada entrada** de cada MC | Un solo número por MC por entrada + puntos extras al final | 0–4 |

**C1 — Sistema por patrón (FMS/Red Bull)**

Flujo de votación:
1. MC1 rapea entrada → host presiona "entrada completada"
2. Jueces votan inmediatamente: `{ mc1Points: 0-4 }` para esa entrada
3. MC2 rapea entrada → jueces votan: `{ mc2Points: 0-4 }`
4. Al finalizar todas las entradas → jueces dan `{ extraPoints_mc1: 0-4, extraPoints_mc2: 0-4 }` (impresión general)
5. Total = suma de puntos por entrada + puntos extras

Nuevos tipos necesarios:
```ts
type VotingSystem = "rubrica" | "patron";

interface PatronEntryVote {
  judgeId: string;
  entryIndex: number;       // qué entrada (0, 1, 2...)
  mcId: string;
  points: number;           // 0-4
}

interface PatronExtraVote {
  judgeId: string;
  mc1Extra: number;         // 0-4 impresión general
  mc2Extra: number;
}
```

`BattleModeConfig` recibe campo `votingSystem: VotingSystem`.
`RoundPhase` agrega `"entry_voting"` para votos por entrada.

---

**C3 — Réplica automática**

Concepto: réplica = **batalla extra completa** dentro de la misma sala, mismos participantes y jueces. No es una sub-fase — es un reinicio del flujo de batalla con su propia configuración.

Disparador: batalla termina → si `|score_mc1 - score_mc2| ≤ tieRange` → réplica automática en la misma sala.

Config en lobby (host define antes de iniciar):
```ts
interface ReplicaConfig {
  enabled: boolean;
  maxReplicas: number;       // máx réplicas permitidas (1, 2, ilimitadas)
  tieRange: number;          // diferencia ≤ N dispara réplica (ej: 2 = diferencia ≤ 2 puntos)
  mode: BattleModeConfig;    // config propia: puede ser 4x4, 8x8, minutos, entradas — independiente del modo principal
}
```

UI en lobby: botones para elegir modo de réplica (4x4 / 8x8 / minutos / entradas custom).

Flujo:
1. Batalla termina → puntaje final calculado
2. Si empate dentro de rango Y réplicas usadas < `maxReplicas` → sala entra a estado `"replica"`
3. Nueva batalla corre en misma sala con `ReplicaConfig.mode` — mismo flujo normal (lobby → in_progress → finished)
4. Si sigue empatado y quedan réplicas → otra réplica
5. Si no hay más réplicas → gana el que tenga más puntos totales

`BattleStatus` agrega: `"replica"`.
`Battle` agrega: `replicaCount: number`, `replicaConfig?: ReplicaConfig`.

---

### ÉPICA D — Formatos de Torneo
> Estructura para múltiples batallas conectadas en bracket eliminatorio.

| # | Tarea | Archivos clave | Complejidad |
|---|-------|----------------|-------------|
| D2 | **Bracket de torneo** | `types.ts`, nuevo `tournamentRoom.ts`, nueva ruta `/tournament` | XL |
| D3 | **Configuración por fase** | `types.ts`, `tournamentRoom.ts` | M (depende D2) |

#### Especificaciones Épica D

**D2 — Bracket de torneo**

- Participantes: solo potencias de 2 (4, 8, 16, 32...)
- Armado de bracket: host elige **manual** (arrastra/asigna quién vs quién) o **aleatorio** (sistema sortea)
- Torneo tiene nombre/título visible para todos los conectados
- Cada enfrentamiento es una `Battle` normal con su propia sala
- El torneo avanza automáticamente cuando una batalla termina → ganador pasa a siguiente fase

```ts
interface Tournament {
  id: string;
  name: string;
  status: "setup" | "in_progress" | "finished";
  participants: TournamentParticipant[];
  phases: TournamentPhase[];
  currentPhaseIndex: number;
  bracketMode: "manual" | "random";
  createdAt: string;
}

interface TournamentParticipant {
  userId: string;
  alias: string;
  eliminated: boolean;
}

interface TournamentPhase {
  name: string;               // personalizable: "8vos", "Eliminatoria", "Gran Final", etc.
  battles: TournamentBattle[];
  modeConfig: BattleModeConfig;
  replicaConfig?: ReplicaConfig;
}

interface TournamentBattle {
  battleId: string;
  mc1Id: string;
  mc2Id: string;
  winnerId?: string;
}
```

**D3 — Configuración por fase**

Dos modos de configurar:

1. **Fast mode**: host elige un `BattleModeConfig` + `ReplicaConfig` → se aplica igual a todas las fases
2. **Config por fase**: host configura cada fase individualmente — modo, réplica, nombre personalizado

Nombres de fase: predefinidos (`"8vos de final"`, `"Cuartos"`, `"Semifinal"`, `"Final"`) o texto libre.

Cada fase tiene su propia `ReplicaConfig` independiente.

---

## Orden de Implementación Recomendado

```
Sprint 1 — Base sólida
  A1 elegir quién parte
  A2 modo libre/sin concepto
  A3 modificar tiempos
  A5 categorías

Sprint 2 — Audiencia y control
  B1 observadores
  A4 4x4
  C1 formato FMS/Red Bull

Sprint 3 — Dinámica de batalla
  C3 réplica
  B2 host

Sprint 4 — Torneo
  D2 bracket torneo
  D3 config por fase
```

---

## Estado por Tarea

| ID | Estado |
|----|--------|
| A1 | ⬜ pendiente |
| A2 | ⬜ pendiente |
| A3 | ⬜ pendiente |
| A4 | ⬜ pendiente |
| A5 | ⬜ pendiente |
| B1 | ⬜ pendiente |
| B2 | ⬜ pendiente |
| C1 | ⬜ pendiente |
| C3 | ⬜ pendiente |
| D2 | ⬜ pendiente |
| D3 | ⬜ pendiente |

---

## Notas Técnicas

- **`BattleMode`** en `types.ts` actualmente solo tiene `"clasico"`. Agregar `"libre"`. Modo entradas no es un `BattleMode` sino `timerMode: "manual"` dentro de `BattleModeConfig`.
- **`VotingSystem`** es nuevo campo en `BattleModeConfig` — ortogonal al modo de turno. `"rubrica"` = actual, `"patron"` = FMS/Red Bull.
- **`ScoreRubric`** (5 dimensiones) se mantiene para `"rubrica"`. Para `"patron"` se usan `PatronEntryVote` + `PatronExtraVote` (escala 0–4).
- **Réplica** = batalla completa que corre en la misma sala con `BattleStatus: "replica"`. No sub-fases.
- **Torneo** requiere nueva entidad `Tournament` + `tournamentRoom.ts` → scope XL, sprint propio.
- **Observadores** no se agregan a `participants` ni `judges` → lógica pequeña en `joinBattle()`.
- **Host** = 1 por sala, puede acumular rol `judge`, admin transfiere control.
