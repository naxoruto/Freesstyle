# Especificación — Batalla individual (1vs1)

> **Estado:** aprobada (25 de noviembre de 2026). Fase 1 del [Plan de trabajo](../PLAN_DE_TRABAJO.md).
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

- **Invitación unificada** (C4, revisión 26/11/2026): el control superior copia un mensaje con el código y el enlace de invitación válido. Se elimina el bloque duplicado inferior; el organizador puede renovar el enlace en la cabecera. La confirmación de copia no desplaza la página.
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

## 13. Revisión del lobby solicitada el 26/11/2026

- «Editar formato» abre un modal con desplazamiento interno, conservando la posición de la página; las opciones se guardan al seleccionarlas. Se reutiliza el mismo `Dialog` para roles, MC y cartelera.
- El host es opcional y se puede deseleccionar con «Sin host». Por tiempo, el reloj lo lleva el servidor; el control manual permite también avanzar fases. Por entradas, el control manual es necesario y el organizador puede marcar las entradas sin asignar host.
- El organizador puede agregar, renombrar y quitar MC presenciales desde los puestos libres, en orden MC1/MC2, antes de iniciar. No se sobreescribe un MC digital; primero debe cambiarse su rol. Se validan permisos, cupo, nombre e identidad esperada para evitar ediciones de otro puesto cuando actúan dos organizadores.
- Los MC presenciales no necesitan cuenta ni dispositivo y reciben las puntuaciones normales de los jueces. No son sesiones ni miembros conectados ficticios. Se persisten en los registros habituales de participantes con IDs `local:` reservados al servidor; ese prefijo se rechaza en el acceso digital. La recuperación conserva sus nombres, orden y resultados sin exigir su reconexión; jueces y miembros digitales sí deben volver.
- «Personas y roles» presenta tarjetas con emoji, nombre y roles; al pulsarlas se elige un rol con botones cuadrados. El permiso de organizador sigue siendo independiente de MC/Juez/Público/Host.

Comprobaciones de esta entrega: pruebas unitarias de permisos, puntuación, recuperación, ediciones obsoletas y fallos de escritura usando repositorios simulados; typecheck, lint y build. La comprobación visual y la persistencia contra PostgreSQL real quedan pendientes de un entorno disponible.

### Ajuste posterior de tarjetas y votación individual

- Tarjetas de personas compactas de 140 px, distribuidas en filas sin expandirse cuando solo hay una. Nombres largos pueden partirse en varias líneas.
- **Confirmado por el usuario:** cada juez debe poder configurar su método de votación (rúbrica, patrón o voto libre), separado del formato de la batalla. Cinco jueces pueden usar métodos diferentes.
- **Confirmado por el usuario:** cada juez aporta un único voto final (MC1, MC2 o réplica), todos pesan lo mismo y el resultado se decide por mayoría. Ese voto se emite una vez al terminar todas las rondas de la batalla, no al cerrar cada ronda.
- **Confirmado por el usuario:** los puntos de los métodos con tabla deben determinar automáticamente el voto final del juez. La acumulación y el empate exacto de la Votación clásica FMS se concretan abajo; los demás métodos se repasan por separado. En voto libre, el juez elige directamente su veredicto.
- **Réplicas, confirmado por el usuario:** todos los jueces pasan obligatoriamente a voto libre durante las réplicas, cualquiera que fuese su método original. El veredicto de réplica se basa en la actuación de esa réplica; la tabla FMS original no determina ese voto. Falta confirmar si el voto libre de una réplica admite pedir otra réplica o exige elegir MC1/MC2.
- **Solicitado:** separar la preparación de jueces del «3, 2, 1»: necesitan ver y entender su tabla antes de empezar a competir. Actualmente «Iniciar batalla» activa la cuenta atrás inmediatamente. Falta definir si se espera una confirmación de cada juez, una acción adicional del organizador o un tiempo de preparación; ninguna de esas alternativas está aprobada todavía.
- **Pendiente de definir:** elección/cambio del método, reglas concretas de cada tabla y casos sin mayoría antes de implementar el nuevo cálculo. Repasar rúbrica, patrón y voto libre uno por uno, con ejemplos del usuario.
- **Estado técnico:** la votación individual aún no está implementada. El cálculo y el selector global existentes se mantienen mientras se termina de definir esta revisión.

### Votación clásica FMS: ejemplo del usuario y estructura confirmada

- **Nombre confirmado por el usuario:** «Votación clásica FMS» para este estilo de tabla, descrito antes como rúbrica. Esta denominación se aplicará a la nueva experiencia; el selector actual todavía no se ha renombrado ni sustituido.
- **Escala confirmada por patrón:** de 0 a 4 inclusive, admitiendo medios puntos; valores permitidos: 0, 0,5, 1, 1,5, 2, 2,5, 3, 3,5 y 4.
- **Escala confirmada de agregados:** Escena y Flow usan también de 0 a 4 en pasos de 0,5, con una nota de cada criterio por MC para la ronda completa.
- **Suma confirmada por MC y ronda:** suma de todos sus patrones + Escena + Flow, sin pesos ni multiplicadores. Con cuatro patrones, el máximo es 24 puntos (4 × 4 + 4 + 4); en general, 4 × cantidad de patrones + 8.
- **Veredicto automático confirmado:** cada juez suma los puntos de todas las rondas de cada MC. Su único voto final va al MC con mayor total; si los totales son exactamente iguales, su voto es réplica. No se aplica un margen de diferencia. Estos son los votos individuales que después se combinan por mayoría, con igual peso por juez.
- El juez puntúa las rimas durante la batalla, ronda a ronda y patrón/entrada a patrón/entrada. Se distingue del voto libre, donde escucha y emite su veredicto al final.
- Cada ronda presenta una tabla con una fila por MC. «Gallo» en la imagen de referencia corresponde al nombre del MC.
- La cantidad de casillas de patrones por fila responde a las entradas del MC: con cuatro entradas, cuatro casillas por MC. No fijar seis casillas a partir del ejemplo gráfico.
- Escena y Flow son agregados por MC para la ronda completa, separados de las casillas de patrones. Esta es la estructura solicitada para la nueva rúbrica; la tabla actual de cinco criterios globales todavía no se ha sustituido en código.
- Easy Mode, Hard Mode, Temática, Personajes y Sangre son referencias de la imagen, no una aprobación de crear automáticamente esas rondas o modalidades.
- **Pendiente común:** preparación y elección de métodos, combinación de veredictos sin mayoría y posibilidad de nuevas réplicas. La tabla y el cálculo nuevos siguen sin implementarse.
