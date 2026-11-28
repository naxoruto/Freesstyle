# Cambios y prioridades

Registro central para continuar el proyecto sin depender del historial del chat. Los detalles técnicos y de producto permanecen en los documentos enlazados; este archivo indica alcance, estado y siguiente decisión.

## Cómo interpretar el estado

- **Implementado y verificado:** existe en código y tiene evidencia documentada de comprobación.
- **Pendiente técnico:** trabajo identificado que todavía no está terminado.
- **En definición:** dirección solicitada; faltan decisiones antes de implementar.
- **Propuesta:** recomendación que aún no se ha aprobado.
- **Histórico:** conserva contexto; no determina por sí solo la prioridad actual.

## Prioridad actual

La batalla individual ya tiene su recorrido de producto entregado; queda T12 (refactor de la página). El torneo tiene el backend, el formulario, la inscripción guiada del organizador (T10) y el enlace público (T10b) entregados; siguen T11–T13. Las decisiones pendientes se cierran antes de implementar el comportamiento al que afectan. La reorganización de documentos no modifica las reglas de juego.

| ID | Iniciativa | Estado | Referencia / siguiente paso |
|---|---|---|---|
| ORG-01 | Índice y orientación para IA | Implementado | [INDEX](../../INDEX.md), [AGENTS](../../AGENTS.md) |
| ORG-02 | Reunir documentación y separar antecedentes | Implementado | [Organización](../ORGANIZACION.md) |
| UX-01 | Mejorar batalla individual | Flujo inicial, roles, exhibición, selector y estabilidad de modalidad confirmados | [Decisiones de batalla](brainstorming/01-batalla-individual.md); preparar especificación tras revisar las demás experiencias |
| UX-02 | Mejorar torneos | Backend e inscripción T10/T10b implementados; T11 en implementación; pendientes T12–T13 | [Especificación de torneo](specs/torneo.md); [plan](planes/torneo.md) |
| UX-03 | Mejorar Rey de la pista | En definición | [Notas previas](brainstorming/03-rey-de-pista.md); confirmar reglas de sesión abierta |
| PERF-01 | Perfil y registro con Google o correo | En definición; solicitado por el usuario | [Estructura y perfil](brainstorming/00-estructura-y-perfil.md); invitados con nombre o cuenta para guardar perfil e historial, confirmado |
| PERF-02 | Foto y datos personales del perfil | En definición | Determinar campos, visibilidad y edición |
| PERF-03 | Estadísticas por rol y nivel general | Dirección registrada en notas previas | [Perfiles y niveles](brainstorming/04-perfiles-y-niveles.md); reconciliar con el nuevo alcance |
| TOR-01 | Persistencia y recuperación de torneos | Implementado (núcleo) | Modelo `Tournament`, persistencia por torneo y recuperación en arranque con su `adminToken`; falta la capa web de operación |
| DEMO-01 | Demo completa y aislada | Pendiente técnico | Revisar alcance de la demo existente antes de sustituirla |
| VIS-01 | Pulido móvil, espaciado e identidad visual | Sistema de diseño en implementación inicial; migración pendiente | [Guía de componentes UI](GUIA_COMPONENTES_UI.md); continuar UI-02/03 por etapas |
| JUEGOS-01 | Evolución de juegos diarios | Backlog especializado | [Plan de juegos](GAMES_PLAN.md); no adelantarse a la prioridad actual |

## Trabajo de esta conversación ya entregado

| ID | Resultado | Estado y evidencia |
|---|---|---|
| TEC-01 | Auditoría, plan y entorno reproducible | Entrega registrada en [entorno local](../ENTORNO_LOCAL.md); [plan de arranque histórico](../archivo/RETOMAR_2026-11-22.md) |
| TEC-02 | Permisos, invitaciones, sesiones persistidas y revocación | Implementado; [contrato de recuperación](../RECUPERACION_BATALLAS.md) |
| TEC-03 | Votos y resultados separados por ronda y réplica | Implementado; migraciones y pruebas de persistencia |
| TEC-04 | Escrituras críticas confirmadas antes de notificarse | Implementado; transacciones de resultados, entradas y padrón; bloqueo ante fallos |
| TEC-05 | Recuperación de batallas activas y reanudación explícita | Implementado; sesiones, votos, padrón, plazos y validación de históricos; última entrega: 224 pruebas y comprobadores de reinicio |
| TEC-06 | Migraciones de recuperación en la base local | Aplicadas después de respaldo, restauración de prueba y ensayo de migración; otros entornos requieren su propia actualización |
| TEC-07 | Generación de Prisma bloqueada en Windows | Resuelto cerrando el servidor que ocupaba la DLL; procedimiento en la guía de entorno |
| TEC-08 | Fase 0 del plan: higiene (artefacto de git, Makefile, docker, respaldos) y consistencia (IDs de mayor entropía y bloqueo ante fallos de persistencia) | Implementado; 229 pruebas verdes; detalle en [Plan de trabajo](../PLAN_DE_TRABAJO.md) |
| TEC-09 | Fase 1 (batalla individual) — recorrido de producto entregado: T1–T11 + pulido (C7/C11/C12/C15); T12 (refactor) pendiente | Implementado; 242 pruebas al cierre de la entrega; [especificación](specs/batalla-individual.md) y [plan](planes/batalla-individual.md) |
| TEC-10 | Fase 2 (torneo) — backend T1–T8 y formulario web T9 | Implementado; 246 pruebas verdes y typecheck limpio al cierre de T9; [plan](planes/torneo.md). En ese momento faltaban T10–T13 y T10b |
| TEC-11 | Fase 2 (torneo) — T10: reglas antes de crear, inscripción manual guiada, titulares/suplentes, mover/quitar y confirmar | Implementado; 251 pruebas del servidor, lint/typecheck/build y recorrido HTTP/navegador sobre base descartable |
| TEC-12 | Fase 2 (torneo) — T10b: autoinscripción por enlace, estado individual, reglas vigentes y cierre al confirmar | Implementado; 256 pruebas del servidor. El organizador recupera el torneo en la misma sesión tras recargar |
| TEC-13 | Fase 2 (torneo) — T11: sorteo separado del inicio, reorden manual y auditoría visible | En implementación; cerrar según decisiones registradas y validar antes de marcar como entregado |
| TEC-14 | Sistema de diseño UI: auditoría, componentes base y migración inicial | UI-01 documentado; UI-02 implementado inicialmente; UI-03 migró controles del torneo y batalla, con páginas restantes pendientes | [Plan de trabajo §10.1](../PLAN_DE_TRABAJO.md); [guía de componentes UI](GUIA_COMPONENTES_UI.md) |

La recuperación de batallas no implica recuperar el torneo al que pertenecen. Tampoco reconstruye votos históricos que solo existían en memoria o fueron sobrescritos antes de las migraciones.

El 26 de noviembre de 2026 se añadió `Iniciar Freestyle.cmd` para iniciar web y backend con doble clic, comprobar PostgreSQL y migraciones y abrir el navegador tras verificar disponibilidad. Puede arrancar el contenedor local existente; no aplica migraciones. Sintaxis y diagnóstico sin base comprobados; simulación del bloqueo por migraciones, URL de Socket.IO, apertura tras disponibilidad y cierre limitado a procesos propios. El arranque completo queda pendiente con PostgreSQL disponible. Uso en [Entorno local](../ENTORNO_LOCAL.md); seguimiento DX-05 en el plan de trabajo.

## Documentos históricos

[Plan antiguo](../archivo/PLAN.md), [ejecución anterior](../archivo/EXECUTION_PLAN.md), [requerimientos anteriores](../archivo/UPDATES.md), [handoff de datos de julio](../archivo/HANDOFF_DATOS_2026-07-28.md). Conservan el trabajo previo, pero sus prioridades y cifras pueden estar desactualizadas.

## Registro de decisiones nuevas

El 28/11 se solicita rediseñar la configuración de batallas de 1vs1 y torneo para reducir el aspecto de planilla, ordenar las opciones y explicar sus efectos con lenguaje sencillo. Se confirma un recorrido para quien crea mediante «Siguiente», con opciones preseleccionadas, llegada al lobby y edición posterior antes de iniciar. Se confirma elegir la cantidad de rondas y configurar el formato y la cantidad de entradas de cada ronda de forma independiente. Se confirma separar intercambio (4x4, 8x8, 12x12 de 30 segundos por intervención alternando A → B → A → B… y 16x16 de 1 minuto por intervención: A → B → B → A suma cuatro minutos de rap), patrones (1–5, con mínimo 3 en 4x4 y 1 obligatorio con ida y vuelta A → B → B → A en 16x16) y contenido (Libre, Con concepto/temática, Random Mode cada 10 segundos, Hard Mode cada 5 y Deluxe 4x4 con los primeros dos patrones a capella de cada competidor). Con imagen queda para el futuro. Se confirma, tras corregir una restricción inicial, que Random Mode y Hard Mode admiten los cuatro intercambios: 4x4, 8x8, 12x12 y 16x16. Se aprueba el orden definitivo de cada ronda: Contenido → Intercambio → Cantidad de patrones, sustituyendo el orden anterior con patrones primero. En 4x4, 8x8 y 12x12, N patrones significa N intervenciones por MC: tres producen A → B → A → B → A → B. Se confirma mantener los formatos incompatibles visibles, deshabilitados y con explicación del requisito. La correspondencia con casillas FMS del 16x16 y las combinaciones aún requieren definición; reglas detalladas en el brainstorming. El diseño de pasos y opciones sigue abierto; no hay cambio funcional implementado. Se conserva la inscripción guiada de torneos. Detalle en [brainstorming de batalla](brainstorming/01-batalla-individual.md#configuración-guiada--decisión-del-28-de-noviembre-de-2026); seguimiento en §10.1 del plan consolidado.

Ampliación del 27/11: se solicitan dos configuraciones independientes: votación en vivo (visible para público, excluidos los MC que compiten) o privada; y veredicto solo al host para anuncio verbal o ganador en todas las pantallas. En ambos casos se podrá consultar qué votó cada juez. Se confirma que en vivo el público ve tanto las notas ingresadas/corregidas como el voto final confirmado, manteniendo la exclusión de los MC que compiten. Se confirma que en privado, tras anunciar el resultado, todos pueden consultar solo el ganador y a quién votó cada juez, sin notas ni tablas públicas. Se confirma «Veredicto anunciado»: en modo solo host, el host libera con ese botón el resumen del ganador y los votos individuales para el resto. Si el host se desconecta antes del anuncio, el organizador puede recibir el veredicto y asumir ese botón, conservando la privacidad. Se confirma aislamiento entre jueces para evitar influencia: cada uno ve solo sus propias notas y no los votos ajenos hasta confirmar su voto final, aun con votación en vivo para el público. Se confirma anuncio manual sin host inicialmente asignado: el organizador recibe el veredicto y usa «Veredicto anunciado». Se confirma «Voto secreto» como opción predeterminada de nuevas batallas, modificable a votación en vivo antes de empezar. Se confirma mostrar automáticamente el ganador a todos como entrega predeterminada, con consulta de votos individuales; se conserva el anuncio manual del host/organizador como opción configurable antes del inicio, independiente de la privacidad. Se documenta como pendiente de implementación y se añade JV-07 para filtrado de datos en servidor, HTTP y sockets; especificación §13.

El 27/11 el usuario aprueba la propuesta visual de la pantalla de juez (FMS, por rondas y libre). FMS se centra en la ronda actual con acceso a las anteriores, y se conserva el contexto de MC, método, ronda, turno y reloj. La maqueta usa datos de ejemplo; la integración sigue pendiente. Se confirma que el juez puede corregir notas de rondas anteriores durante la batalla hasta emitir su voto final. Se confirma «Confirmar planilla» al finalizar para cerrar notas y calcular automáticamente el voto, conservando el desempate libre cuando corresponda. Detalle en [especificación §13](specs/batalla-individual.md), [maqueta](propuestas/vista-juez.html) y bloques JV del [plan](planes/batalla-individual.md).

Definición del usuario del 27/11: la alternativa antes llamada «por patrón» pasa a ser votación por rondas: una nota entera de 0 a 10 por MC y ronda completa (A=8 y B=7 implica que A gana esa ronda). Se confirma ofrecer ambas alternativas como subcategorías a elegir: contar rondas ganadas o sumar todas las notas. Se proponen los nombres «Rondas ganadas» y «Puntaje acumulado». Se confirma desempate final como FMS en ambas: réplica si está permitida; de lo contrario el juez elige MC1/MC2 por voto libre. Se confirma que ambas subcategorías solo admiten enteros, sin medios puntos. Se confirma que una ronda empatada no suma una victoria a ninguno en «Rondas ganadas». Se confirma preparación: cada juez elige su método, revisa su vista y pulsa «Estoy listo»; solo entonces el organizador puede activar la cuenta atrás, tras estar todos listos. Se confirma que método y subcategoría quedan bloqueados durante la batalla; se mantienen las transiciones obligatorias a voto libre ya acordadas. Se confirma que cambiar el método o la subcategoría antes de iniciar anula el «Estoy listo» de ese juez; cambiar el formato anula el de todos. Deben confirmar nuevamente para habilitar la cuenta atrás. Voto libre evalúa toda la batalla y elige un MC una sola vez al cierre, independientemente de la cantidad de rondas. Se mantienen las reglas específicas de réplicas. Definiciones registradas, sin implementación todavía; detalle en [especificación §13](specs/batalla-individual.md).

Aclaración del 27/11/2026: cuando no se permiten más réplicas, tampoco se permite emitir ese voto. Se registra la restricción para interfaz y validación del servidor; la votación individual nueva sigue pendiente de implementación. Se confirma posteriormente que un reparto de cinco jueces 2 por MC1, 2 por MC2 y 1 por réplica produce réplica cuando sí queda alguna permitida.

Se confirma para la Votación clásica FMS la suma de todas las rondas por juez: su voto final va al MC con mayor total; empate exacto produce un voto de réplica. En las réplicas, todos los jueces usan obligatoriamente voto libre, independientemente del método original. Pueden pedir otra réplica solo si quedan disponibles según el límite configurado; al agotarlas deben elegir MC1/MC2. Se confirma que un juez con empate exacto en FMS pasa a voto libre obligatorio entre MC1/MC2 si no quedan réplicas permitidas. Se confirma mayoría absoluta para ganar: más de la mitad de los votos (2 de 3 o 3 de 5); si ningún MC la alcanza y queda réplica permitida, el resultado es réplica. Estas reglas están documentadas y pendientes de implementación.

El usuario denomina «Votación clásica FMS» a la nueva tabla descrita como rúbrica, y confirma puntuación de patrones, Escena y Flow de 0 a 4 en pasos de 0,5. Escena y Flow se califican una vez por MC para toda la ronda. Se confirma suma directa de patrones + Escena + Flow, sin multiplicadores (máximo de 24 puntos por MC y ronda con cuatro patrones). Se confirma sumar todas las rondas por juez: el mayor total determina su voto y un empate exacto produce voto de réplica. Es una decisión de producto registrada, todavía sin cambio del selector ni del cálculo en la aplicación; detalle en [especificación §13](specs/batalla-individual.md).

Ejemplo de rúbrica del 26/11: se confirma tabla por ronda, filas de MC, tantas casillas de patrones como entradas y agregados Escena/Flow para la ronda completa. Se diferencia del voto libre al cierre. Las escalas y la conversión de puntos a veredicto siguen en definición; no se ha implementado esta tabla. La imagen es referencia de estructura, no aprobación de añadir sus modos de ronda. Detalle en [especificación §13](specs/batalla-individual.md).

Pulido posterior del 26/11: se compactan las tarjetas de personas (140 px sin expansión). Se confirma que el método de votación lo elige cada juez y debe separarse del formato de batalla; cada juez aporta un único voto final (MC1, MC2 o réplica) al terminar todas las rondas, con igual peso y decisión por mayoría. Se confirma que los puntos de rúbrica/patrón calculan automáticamente ese voto; falta concretar las tablas con ejemplos del usuario. Se confirma preparación de jueces antes de activar el «3, 2, 1»: todos deben pulsar «Estoy listo» y después el organizador inicia la cuenta atrás. El cambio funcional de votación aún no está implementado; reglas en [especificación §13](specs/batalla-individual.md).

Revisión 1vs1 del 26/11/2026: se implementan los seis ajustes solicitados de copia estable, formato en modal, host opcional, MC presenciales, tarjetas de roles e invitación unificada. El usuario confirmó MC sin cuenta ni dispositivo, con control del organizador y puntuación habitual de jueces. Detalle y límites de verificación en [especificación §13](specs/batalla-individual.md) y catálogo actualizado en [guía UI](GUIA_COMPONENTES_UI.md).

| ID | Decisión | Estado |
|---|---|---|
| DEC-001 | Revisar batalla individual, torneos y Rey de la pista antes del siguiente bloque técnico | Solicitado por el usuario |
| DEC-002 | Incorporar perfil con registro mediante Google o correo y posibilidad de foto | Solicitado; detalles en definición |
| DEC-003 | Mantener un índice para IA y un registro central de cambios | Solicitado e implementado |
| DEC-004 | Permitir participar como invitado indicando un nombre; con cuenta se conserva perfil e historial | Confirmado por el usuario; regla común para los tres modos |
| DEC-005 | Inicio: «Crear batalla» abre la elección 1vs1, torneo o Rey de la pista | Confirmado el 23 de noviembre de 2026; pendiente de implementar |
| DEC-006 | Pedir el nickname después de elegir 1vs1 y conservar el resto del recorrido actual | Confirmado el 23 de noviembre de 2026; no implica saltar automáticamente al lobby |
| DEC-007 | Host y público opcionales; permitir 1vs1 sin juez cuando solo participan dos personas | Confirmado el 23 de noviembre de 2026; concretado como exhibición en DEC-008 |
| DEC-008 | Poder seleccionar «Exhibición», sin juez obligatorio ni puntaje de jueces; el 1vs1 de solo dos personas queda como exhibición | Confirmado el 23 de noviembre de 2026; selector concretado en DEC-010 |
| DEC-009 | La exhibición termina sin ganador oficial y conserva turnos, tiempos y conceptos elegidos | Confirmado por el usuario el 23 de noviembre de 2026; pendiente de implementar |
| DEC-010 | Selector «Batalla con jueces / Exhibición» en el lobby junto al formato; Exhibición seleccionada cuando solo están los dos MC | Confirmado por el usuario el 23 de noviembre de 2026 |
| DEC-011 | La entrada de público, host o jueces no cambia la modalidad; solo el administrador puede cambiarla antes de iniciar | Confirmado por el usuario el 23 de noviembre de 2026; pendiente de implementar |
| DEC-012 | El torneo permite añadir nombre, logo y organizador; este puede ser una persona o asociación | Solicitado el 23 de noviembre de 2026; obligatoriedad y relación con perfiles pendientes |
| DEC-013 | Rey de la pista es una modalidad distinta y no aparece entre los tipos de torneo | Confirmado el 23 de noviembre de 2026; pendiente de implementar |
| DEC-014 | Contemplar repesca cuando alguien no llega y definir la fila de entrada | Solicitado el 23 de noviembre de 2026; reglas pendientes de acordar |
| DEC-015 | Batalla individual: resumen de reglas, entrada directa al lobby, bloque de invitación, selector Exhibición, mensaje de jueces 1/3/5, revancha y repetir formato | Confirmado el 25 de noviembre de 2026; detalle en [Plan de trabajo](../PLAN_DE_TRABAJO.md) Fase 1 |
| DEC-016 | Torneo: recuperable, logo y organizador, sorteo revisable, inscripción, cuadro en vivo y repesca por inasistencia | Confirmado el 25 de noviembre de 2026; detalle en Fase 2 |
| DEC-017 | Rey de la pista: sesión abierta, «el vencedor elige» / «fila determinada», «con límite» / «infinito», voto de concursantes | Confirmado el 25 de noviembre de 2026; detalle en Fase 3 |
| DEC-018 | Perfil y cuentas: Google o correo, foto, nombre/AKA/crew, nivel general y estadísticas por rol | Confirmado el 25 de noviembre de 2026; detalle en Fase 4 |
| DEC-019 | Experiencia transversal: modo pantalla, estados vacíos, presencia en vivo, avisos sonoros, compartir cartel, accesibilidad y landing | Confirmado el 25 de noviembre de 2026; detalle en el track técnico |
| DEC-020 | Plan de trabajo consolidado en [Plan de trabajo](../PLAN_DE_TRABAJO.md); es el plan único y no compite con este registro | Confirmado el 25 de noviembre de 2026 |
| DEC-021 | Torneo: recorrido guiado «crear → inscribir y confirmar → sortear e iniciar»; reglas fijadas antes de compartir y editables hasta iniciar; el organizador puede mover o quitar inscritos; quien se inscribe ve su estado y reglas vigentes; la inscripción pública se cierra al confirmar titulares | Confirmado el 25 de noviembre de 2026; detalle en [especificación de torneo](specs/torneo.md). Pendiente de implementar |
| DEC-022 | La interfaz web debe usar un sistema de diseño y una biblioteca compartida para controles comunes; antes de crear UI nueva se revisa el catálogo para reutilizar o extender componentes. Las excepciones de identidad visual se conservan cuando son intencionales y quedan documentadas | Confirmado el 25 de noviembre de 2026; plan en [§10.1](../PLAN_DE_TRABAJO.md) y [guía UI](GUIA_COMPONENTES_UI.md); implementación inicial en curso |

Al aprobar una decisión nueva, registrarla aquí y desarrollar sus reglas en el documento de producto correspondiente. No abrir otro plan global que compita con este registro; el [Plan de trabajo](../PLAN_DE_TRABAJO.md) lo complementa y no lo sustituye.
