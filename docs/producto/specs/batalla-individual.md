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
- **Confirmado por el usuario:** cada juez debe poder configurar su método de votación (Votación clásica FMS, votación por rondas o voto libre), separado del formato de la batalla. Cinco jueces pueden usar métodos diferentes. La alternativa antes llamada «por patrón» se redefine como evaluación global por ronda; su nombre actual en código no refleja esta nueva definición.
- **Confirmado por el usuario:** cada juez aporta un único voto final (MC1, MC2 o réplica), todos pesan lo mismo y el resultado se decide por mayoría. Ese voto se emite una vez al terminar todas las rondas de la batalla, no al cerrar cada ronda.
- **Confirmado por el usuario:** los puntos de los métodos con tabla deben determinar automáticamente el voto final del juez. La acumulación y el empate exacto de la Votación clásica FMS se concretan abajo; los demás métodos se repasan por separado. En voto libre, el juez elige directamente su veredicto.
- **Réplicas, confirmado por el usuario:** todos los jueces pasan obligatoriamente a voto libre durante las réplicas, cualquiera que fuese su método original. El veredicto de réplica se basa en la actuación de esa réplica; la tabla FMS original no determina ese voto. Pueden votar otra réplica solo si la configuración permite más y quedan réplicas disponibles. Si se alcanzó el límite, cada juez debe elegir MC1 o MC2; no se ofrece la opción de otra réplica.
- **Aclaración confirmada el 27/11/2026:** si no se permiten más réplicas, no se puede emitir un voto de réplica. La nueva implementación deberá reflejar la restricción en la interfaz y validar el límite en el servidor.
- **Mayoría absoluta confirmada el 27/11/2026:** un MC gana con más de la mitad de los votos de los jueces: 1 de 1, 2 de 3 o 3 de 5. Si ninguno la alcanza y queda alguna réplica permitida, el resultado es réplica. Incluye los repartos 2/2/1 y 2/1/2 con cinco jueces. Cuando no quedan réplicas, todos los votos deben elegir MC1/MC2, aplicando también la excepción de empate FMS por voto libre.
- **Preparación confirmada el 27/11/2026:** antes de competir, cada juez elige su método (y subcategoría si corresponde), revisa su tabla o vista de votación y pulsa «Estoy listo». El organizador solo puede activar el «3, 2, 1» cuando todos los jueces estén listos. La última confirmación de un juez no inicia la cuenta atrás: hace falta la acción del organizador. El arranque inmediato actual aún no se ha cambiado en código.
- **Bloqueo confirmado por el usuario:** una vez iniciada la batalla, cada juez conserva el método y la subcategoría elegidos hasta terminar. No se permiten cambios voluntarios durante la batalla. Se mantienen las transiciones obligatorias a voto libre ya acordadas para las réplicas y para resolver empates de tablas cuando no quedan réplicas permitidas.
- **Actualización de preparación confirmada:** antes de empezar, cambiar el método o la subcategoría de un juez anula su «Estoy listo», y ese juez debe revisar su vista y confirmar nuevamente. Si el organizador cambia el formato de la batalla, se anulan las confirmaciones de todos los jueces y todos deben volver a marcar «Estoy listo». El organizador solo podrá activar la cuenta atrás tras completarse nuevamente las confirmaciones requeridas.
- **Estado técnico:** la votación individual aún no está implementada. El cálculo y el selector global existentes se mantienen mientras se termina de definir esta revisión.

### Votación clásica FMS: ejemplo del usuario y estructura confirmada

- **Nombre confirmado por el usuario:** «Votación clásica FMS» para este estilo de tabla, descrito antes como rúbrica. Esta denominación se aplicará a la nueva experiencia; el selector actual todavía no se ha renombrado ni sustituido.
- **Escala confirmada por patrón:** de 0 a 4 inclusive, admitiendo medios puntos; valores permitidos: 0, 0,5, 1, 1,5, 2, 2,5, 3, 3,5 y 4.
- **Escala confirmada de agregados:** Escena y Flow usan también de 0 a 4 en pasos de 0,5, con una nota de cada criterio por MC para la ronda completa.
- **Suma confirmada por MC y ronda:** suma de todos sus patrones + Escena + Flow, sin pesos ni multiplicadores. Con cuatro patrones, el máximo es 24 puntos (4 × 4 + 4 + 4); en general, 4 × cantidad de patrones + 8.
- **Veredicto automático confirmado:** cada juez suma los puntos de todas las rondas de cada MC. Su único voto final va al MC con mayor total; si los totales son exactamente iguales, su voto es réplica. No se aplica un margen de diferencia. Estos son los votos individuales que después se combinan por mayoría, con igual peso por juez.
- **Excepción confirmada el 27/11/2026:** si los totales FMS de un juez empatan exactamente y no hay réplicas permitidas disponibles, ese juez pasa a voto libre y debe elegir MC1 o MC2. El sistema no emite un voto de réplica inválido ni asigna un ganador arbitrario. La excepción corresponde al juez cuya tabla empató.
- El juez puntúa las rimas durante la batalla, ronda a ronda y patrón/entrada a patrón/entrada. Se distingue del voto libre, donde escucha y emite su veredicto al final.
- Cada ronda presenta una tabla con una fila por MC. «Gallo» en la imagen de referencia corresponde al nombre del MC.
- La cantidad de casillas de patrones por fila responde a las entradas del MC: con cuatro entradas, cuatro casillas por MC. No fijar seis casillas a partir del ejemplo gráfico.
- Escena y Flow son agregados por MC para la ronda completa, separados de las casillas de patrones. Esta es la estructura solicitada para la nueva rúbrica; la tabla actual de cinco criterios globales todavía no se ha sustituido en código.
- Easy Mode, Hard Mode, Temática, Personajes y Sangre eran referencias de la imagen; esa imagen no autorizó crear automáticamente todas esas modalidades. Posteriormente, el 28/11, el usuario definió contenidos específicos, incluidos Hard Mode y Con concepto/temática, en el [rediseño de configuración por ronda](../brainstorming/01-batalla-individual.md#intercambio-patrones-y-contenido--ampliación-del-2811). Ese rediseño está pendiente de completar y reconciliar con los contratos de evaluación; no interpretar la lista de la imagen como el nuevo catálogo.
- **Estado de esta revisión:** reglas principales de métodos, resultados, réplicas y preparación confirmadas. La nueva preparación, las tablas y el cálculo por juez están documentados y pendientes de implementación; el código actual sigue usando los métodos globales anteriores.

### Votación por rondas (antes llamada «por patrón»)

- **Confirmado el 27/11/2026:** cada juez asigna una nota de 0 a 10 a cada MC por la ronda completa. Evalúa el conjunto de la actuación de esa ronda, sin calificar cada patrón ni usar la tabla detallada de FMS.
- **Escala confirmada:** solo enteros de 0 a 10 inclusive, en pasos de 1, para ambas subcategorías. No admite medios puntos ni otros decimales. La escala de la Votación clásica FMS conserva sus pasos de 0,5.
- Ejemplo del usuario: en la primera ronda, A recibe 8 y B recibe 7; A gana esa ronda.
- Se mantiene la regla común de aportar un único voto final por juez al terminar la batalla.
- **Confirmado por el usuario:** ofrecer dos subcategorías a elegir, una que define el voto final por cantidad de rondas ganadas y otra que lo define por suma total de las notas. Se conservan ambas alternativas.
- **Nombres propuestos:** «Rondas ganadas» (favorece al MC que gana más rondas) y «Puntaje acumulado» (favorece al MC con mayor suma de notas de todas las rondas). El usuario sugirió nombres como «voto completo»/«puntaje completo»; la denominación final aún puede ajustarse.
- **Desempate final confirmado:** en ambas subcategorías se aplica la misma regla de FMS. Si el resultado final de ese juez empata tras completar todas las rondas, su voto es réplica cuando quede alguna permitida; si no, debe elegir MC1/MC2 mediante voto libre. Se aplica al total de rondas ganadas o de puntos, según la subcategoría elegida.
- **Ronda empatada, confirmado:** en «Rondas ganadas», si los MC reciben la misma nota en una ronda (por ejemplo, 8–8), esa ronda no suma una victoria a ninguno. La comparación final se hace tras completar todas las rondas; si empatan en victorias se aplica el desempate final ya definido.
- La subcategoría también queda bloqueada durante la batalla, según la regla común confirmada.

### Voto libre: evaluación de la batalla completa

- **Confirmado el 27/11/2026:** el juez escucha toda la batalla y elige a un MC al finalizar, tenga dos, tres o cinco rondas. No asigna notas ni elige un ganador de cada ronda.
- Las reglas específicas ya confirmadas para las réplicas permanecen: todos usan voto libre y pueden pedir otra réplica únicamente si queda alguna permitida; al agotarlas deben elegir MC1/MC2.
- Esta definición, la votación por rondas y la nueva tabla FMS siguen pendientes de implementación; el código aún contiene los métodos globales anteriores.

### Diseño visual aprobado de la vista de juez — 27/11/2026

El usuario aprueba con «Me gusta» la [maqueta de las tres vistas](../propuestas/vista-juez.html). Se adopta como base visual para implementar la experiencia del juez. La maqueta contiene datos de ejemplo e interacciones locales; la integración con la aplicación sigue pendiente.

- Base común aprobada: cabecera con los MC, método bloqueado, ronda, turno y reloj; área central específica del método.
- FMS aprobado: tabla de la ronda actual con sus patrones, Escena y Flow, parcial de esa ronda y acceso a las anteriores. En pantallas estrechas se agrupan las casillas por MC.
- Por rondas: tabla de notas por ronda y MC, con resultado de cada ronda y resumen según la subcategoría. La maqueta muestra «Rondas ganadas»; implementar también «Puntaje acumulado» con las reglas confirmadas.
- Voto libre: durante la batalla se conserva el contexto; la selección del ganador aparece al cierre. La maqueta muestra el cierre y una confirmación explícita del voto.
- Edición confirmada por el usuario: el juez puede volver a rondas anteriores y corregir sus notas mientras la batalla sigue en curso, hasta emitir su voto final. Se aplica a las planillas de FMS y votación por rondas; una ronda terminada no bloquea automáticamente sus notas. Tras emitirse el voto final, las notas quedan cerradas para ese veredicto.
- Cierre confirmado: al terminar la batalla, el juez pulsa «Confirmar planilla» para cerrar sus notas y activar el cálculo automático de su voto. Se conservan las excepciones de empate ya acordadas; si no hay réplica permitida, debe completar el veredicto mediante la elección libre MC1/MC2. Un borrador guardado no constituye un voto final.
- Reutilización prevista en la aplicación: `Timer`, `WordDisplay`, `Button`, `Panel`, `Alert` y `Dialog`, adaptando el área de puntuación a las tablas confirmadas. No copiar el HTML de maqueta como un segundo sistema de componentes.

### Visibilidad de votación y entrega del veredicto — 27/11/2026

Dos configuraciones independientes de la batalla, solicitadas por el usuario y pendientes de implementación:

1. **Votación en vivo / voto privado.** En vivo permite que el público vea tanto las notas que cada juez va ingresando y corrigiendo durante la batalla como su voto final cuando lo confirma; el usuario confirma ambas cosas para dar transparencia. Las notas provisionales deben distinguirse del veredicto final. Los MC que están compitiendo no tienen ese acceso. En privado no se muestra al público la votación en vivo. El acceso de jueces respeta el aislamiento indicado abajo.
2. **Veredicto solo al host / ganador en la pantalla de todos.** Cuando hay host, se puede entregar el veredicto solo a él para que lo anuncie; la aplicación funciona como herramienta. La alternativa muestra el ganador a todas las personas de la sala. El desglose de lo que votó cada juez debe poder consultarse en ambos casos.

**Valor inicial confirmado:** las nuevas batallas usan **«Voto secreto»** de forma predeterminada, correspondiente al voto privado definido aquí. El organizador puede cambiarlo a «Votación en vivo» al configurar la batalla antes de empezar. El secreto afecta a la votación durante la batalla; se conserva la publicación posterior del ganador y los votos individuales ya acordada. La entrega del veredicto tiene su propio valor inicial, definido a continuación.

**Publicación de voto privado, confirmada:** una vez anunciado el resultado, todas las personas de la sala pueden consultar únicamente quién ganó y a quién votó cada juez. El resumen público no incluye las notas numéricas, tablas por patrón/ronda ni sus correcciones. Se distingue el desglose de veredictos individuales del detalle de puntuaciones; la aprobación de ese resumen no autoriza publicar las planillas privadas.

**Anuncio del host, confirmado:** en modo «Solo host», después de recibir el veredicto, el host lo anuncia y pulsa «Veredicto anunciado». Esa acción habilita el resumen del ganador y los votos individuales en las pantallas de las demás personas. Antes de esa acción no se publica ese resumen. La política de votación en vivo conserva el acceso a notas/votos que ya se haya autorizado; el anuncio del resultado es una configuración independiente.

**Reemplazo del host, confirmado:** si el host se desconecta antes de anunciar el resultado, el organizador puede recibir el veredicto, asumir el anuncio y pulsar «Veredicto anunciado». Se conserva el mismo resumen para los demás y la misma política de privacidad; la desconexión no publica automáticamente el resultado.

**Sin host desde la configuración inicial, confirmado:** también se permite el anuncio manual. El organizador recibe el veredicto, lo anuncia y pulsa «Veredicto anunciado»; no es obligatorio asignar un host para utilizar esta opción. El resumen se publica con la misma acción explícita y las mismas restricciones de visibilidad.

**Independencia de jueces, confirmada:** hasta confirmar su voto final, cada juez solo ve sus propias notas; no puede consultar notas ni votos de los demás jueces, incluso cuando el público tiene acceso en vivo. El objetivo expresado por el usuario es que no se influyan entre sí. Esta restricción se aplica también si el juez tiene otro rol en la sala. Una vez confirmado su voto, se sigue la política de publicación de la batalla; confirmar no hace públicas las tablas privadas.

**Entrega predeterminada, confirmada:** el ganador se muestra automáticamente en las pantallas de todas las personas cuando se resuelve el resultado final, con consulta de a quién votó cada juez. El organizador puede elegir anuncio manual del host/organizador durante la configuración previa al inicio; en ese modo se mantiene el botón «Veredicto anunciado». La entrega del veredicto y la visibilidad de votos son independientes: publicar el resultado no revela las notas ni las tablas de una votación secreta.

La implementación actual fuerza `showScoresToSpectators: true` y difunde estados/resultados completos a la sala. Para cumplir la nueva configuración habrá que generar vistas autorizadas en el servidor para cada destinatario y aplicar el mismo filtro a eventos de estado, resultados, reconexión y consultas HTTP. Ocultar componentes de la web no implementa el voto privado. No dar por cambiada la visibilidad real hasta completar y verificar esa integración.
