# Especificación — Batalla individual (1vs1)

> **Estado:** borrador para revisión (Fase 1 del [Plan de trabajo](../PLAN_DE_TRABAJO.md)). Pendiente de aprobación.
>
> **Origen:** decisiones de producto confirmadas (CAMBIOS `DEC-005`…`DEC-011`, `DEC-015`) y brainstorming cerrado el 25 de noviembre de 2026.
>
> **Alcance:** solo el recorrido de batalla individual. Torneo, Rey de la pista y perfil se tratan en fases posteriores.

## 1. Objetivo

Que una batalla 1vs1 sea rápida de crear, clara en el lobby y cierre con acciones útiles: presets legibles, modalidad **Exhibición**, resumen de reglas antes de crear, entrada directa al lobby y «Revancha» / «Repetir formato».

## 2. Decisiones confirmadas

| Tema | Decisión |
|---|---|
| Entrada desde Inicio | «Crear batalla» abre la elección **1vs1 / Torneo / Rey de la pista** (DEC-005) |
| Nickname | Se pide **después** de elegir 1vs1 (DEC-006); etiqueta «Tu AKA o nombre visible» |
| Flujo de creación | **Pantalla única**: nickname + presets + resumen de reglas + «Crear» → lobby directo |
| Pantalla «Sala creada» | Se elimina; código/enlace/confirmación viven en el lobby (Q2) |
| Modalidad | Selector **«Batalla con jueces / Exhibición»** en el lobby, junto al formato (DEC-008/010/011) |
| Exhibición | Sin juez ni puntaje; termina **sin ganador oficial**; conserva turnos, tiempos y conceptos (DEC-009) |
| Presets | **Rápida**, **Variado**, **Por entradas** (detalle en §5) |
| Formato personalizado | Si se toca cualquier ajuste, la tarjeta pasa a «Personalizado» (C15) |
| Cierre | «Revancha» (misma config + mismos MC) y «Repetir formato» (misma config, sala vacía) |
| Entrada | Solo por invitación/código; sin `role`/`alias`/`userId` en URL (C32) |
| adminToken | Fuera de `sessionStorage` → cookie httpOnly / token corto (C33) |

## 3. Flujo de creación

```
Inicio → «Crear batalla» → [1vs1 | Torneo | Rey de la pista]
  1vs1 → Pantalla única:
    · «Tu AKA o nombre visible» (precargado si hay perfil)
    · Presets (Rápida / Variado / Por entradas) con resumen legible
    · Resumen de reglas del preset elegido
    · «Cambiar formato» → selector completo (si se toca algo → «Personalizado»)
    · «Crear sala»
  → Lobby directo (código, enlace, confirmación, cartel, roles)
```

- La selección de tipo de experiencia ocurre **antes** de pedir el nickname (DEC-006).
- No hay pantalla intermedia de «Sala creada»: al crear, se navega al lobby y ahí se muestra código, enlace de invitación y confirmación.

## 4. Lobby

- **Bloque «Invitar» unificado** (C4): copiar enlace, copiar código y (posterior) QR.
- **Selector de modalidad** «Batalla con jueces / Exhibición» junto al formato (C8). Solo el admin lo cambia antes de iniciar; la entrada de público/host/jueces no altera la modalidad (DEC-011).
- **Requisitos según modalidad y votación** (C9): no usar la misma comprobación de jueces para todos los sistemas. Ej.: voto de sala no exige jurado.
- **Mensaje de jueces** (C10): «Necesitas 1, 3 o 5 jueces; ahora hay 2 — sobra 1 o falta 1».
- **Rol vs permisos** (C11): distinguir «rol en esta batalla» (MC/Juez/Público/Host) de «permisos de organización» (admin).
- **Resumen real de réplica** (C12): «Hasta N réplicas · diferencia de X puntos · formato Y».

## 5. Presets

Cada preset es una configuración de partida con un resumen legible. Rápida y Variado usan `format: 1x1`; Por entradas usa `4x4`.

| Preset | Configuración | Resumen visible |
|---|---|---|
| **Rápida** | `libre`, 1 ronda, 60s, `countdown`, `free_vote`, one_way | «1 ronda · 1 min por MC · se vota al ganador» |
| **Variado** | 1x1, 3 rondas, 60s, `rubrica`, one_way, **alterna libre/concepto (L→C→L)** | «3 rondas · alterna libre y con concepto · rúbrica» |
| **Por entradas** | `4x4`, 2 rondas, 4 entradas, `manual`, `patron`, control en vivo | «4x4 · 4 entradas por MC · se puntúa cada entrada» |

Reglas asociadas:

- **Opciones de tiempo** (C14): el selector muestra 30s, 45s, 60s, 90s, 120s (hoy solo 1 y 2 min), alineadas con la validación (`COUNTDOWN_TIMES`).
- **Personalizado** (C15): al desviarse del preset se muestra «Personalizado» en la tarjeta.
- **Variado** requiere un cambio de modelo: hoy el modo (`libre`/`clásico`) es por batalla; se añade la alternancia por ronda (impar = libre, par = concepto), empezando libre.

## 6. Modalidad Exhibición

- Seleccionable en el lobby. Cuando solo están los dos MC, queda seleccionada por defecto.
- No exige juez ni puntaje de jueces; permite batallar entre dos personas.
- Conserva turnos, tiempos y conceptos elegidos.
- **Cierre** (A8): pantalla sin ganador, sin puntuación de jueces y sin empate competitivo. Comunica que terminó la práctica sin resultado oficial.

## 7. Cierre (batalla juzgada)

- Ganador + desglose comprensible.
- **«Revancha»**: crea una sala nueva con la misma configuración y los mismos MC.
- **«Repetir formato»**: crea una sala nueva con la misma configuración, vacía (nuevos participantes).
- Ambas piden confirmación de quiénes participarán antes de crear la sala nueva.

## 8. Seguridad y entrada

- **Eliminar entrada por query params** (C32): quitar `role`, `alias`, `alsoAs`, `userId` de las URLs. El único camino de entrada es el código + invitación (`inviteToken`) o el token de admin.
- **adminToken → cookie httpOnly** (C33): al crear la batalla, el servidor emite una cookie httpOnly de corta vida; el token deja de viajar en `sessionStorage` y en el JSON de respuesta.

## 9. Cambios de modelo y configuración

- `BattleMode` pasa a admitir `"variado"` (alternancia libre/concepto por ronda).
- Presets definidos en `packages/shared/src/battleConfig.ts` (fuente de verdad compartida).
- Generación de palabra por ronda: para `"variado"`, impar = libre (sin palabra), par = concepto (genera palabra según `category`).

## 10. Componentes y archivos afectados

- `apps/web/src/app/page.tsx` — elección de tipo + pantalla única de creación.
- `apps/web/src/components/BattleModeSelector.tsx` — presets + opciones de tiempo + «Personalizado».
- `apps/web/src/components/BattleLobby.tsx` — bloque invitar, selector de modalidad, requisitos, mensaje de jueces, rol/permisos, réplica.
- `apps/web/src/app/battle/[id]/page.tsx` — cierre (revancha/repetir/exhibición) y entrada por invitación.
- `apps/server/src/index.ts`, `apps/server/src/rooms/battleRoom.ts` — cookie de admin, entrada por invitación.
- `packages/shared/src/battleConfig.ts`, `packages/shared/src/types.ts` — presets y modo `"variado"`.

## 11. Criterios de aceptación

- Una persona sin conocer la app crea, comparte y completa el cartel sin ayuda.
- Dos MC pueden iniciar una **Exhibición** sin juez y su cierre no muestra ganador.
- No hay `role`/`alias`/`userId` en ninguna URL; el `adminToken` no es accesible desde JavaScript.
- Cada preset muestra su resumen legible; «Cambiar formato» abre el selector; al desviarse aparece «Personalizado».
- Desde el cierre se puede lanzar «Revancha» (mismos MC) y «Repetir formato» (sala vacía).

## 12. Fuera de alcance (Fase 1)

- Torneo y Rey de la pista (fases 2 y 3).
- Perfil, cuentas y progresión (fases 4 y 5).
- QR de invitación (A10) — posterior.
- Refactor estructural del servidor (SRV) — se ejecuta como habilitador, no como objetivo de esta fase.
