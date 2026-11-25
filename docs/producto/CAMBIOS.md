# Cambios y prioridades

Registro central para continuar el proyecto sin depender del historial del chat. Los detalles técnicos y de producto permanecen en los documentos enlazados; este archivo indica alcance, estado y siguiente decisión.

## Cómo interpretar el estado

- **Implementado y verificado:** existe en código y tiene evidencia documentada de comprobación.
- **Pendiente técnico:** trabajo identificado que todavía no está terminado.
- **En definición:** dirección solicitada; faltan decisiones antes de implementar.
- **Propuesta:** recomendación que aún no se ha aprobado.
- **Histórico:** conserva contexto; no determina por sí solo la prioridad actual.

## Prioridad actual

Antes de continuar con la recuperación de torneos: afinar las mejoras de las tres experiencias de juego y el perfil; ordenar la documentación y registrar las decisiones. La reorganización de documentos no modifica las reglas de juego.

| ID | Iniciativa | Estado | Referencia / siguiente paso |
|---|---|---|---|
| ORG-01 | Índice y orientación para IA | Implementado | [INDEX](../../INDEX.md), [AGENTS](../../AGENTS.md) |
| ORG-02 | Reunir documentación y separar antecedentes | Implementado | [Organización](../ORGANIZACION.md) |
| UX-01 | Mejorar batalla individual | Flujo inicial, roles, exhibición, selector y estabilidad de modalidad confirmados | [Decisiones de batalla](brainstorming/01-batalla-individual.md); preparar especificación tras revisar las demás experiencias |
| UX-02 | Mejorar torneos | Nombre, logo y organizador solicitados; repesca y fila en definición | [Decisiones de torneo](brainstorming/02-torneo.md); aclarar reemplazos por inasistencia y orden de entrada |
| UX-03 | Mejorar Rey de la pista | En definición | [Notas previas](brainstorming/03-rey-de-pista.md); confirmar reglas de sesión abierta |
| PERF-01 | Perfil y registro con Google o correo | En definición; solicitado por el usuario | [Estructura y perfil](brainstorming/00-estructura-y-perfil.md); invitados con nombre o cuenta para guardar perfil e historial, confirmado |
| PERF-02 | Foto y datos personales del perfil | En definición | Determinar campos, visibilidad y edición |
| PERF-03 | Estadísticas por rol y nivel general | Dirección registrada en notas previas | [Perfiles y niveles](brainstorming/04-perfiles-y-niveles.md); reconciliar con el nuevo alcance |
| TOR-01 | Persistencia y recuperación de torneos | Pendiente técnico | Modelo, credenciales, cuadro, relación con batallas y resultados idempotentes; retomar después de definir producto |
| DEMO-01 | Demo completa y aislada | Pendiente técnico | Revisar alcance de la demo existente antes de sustituirla |
| VIS-01 | Pulido móvil, espaciado e identidad visual | Propuesta / parcialmente pendiente | Derivar del diseño acordado; revisar assets de cartelera |
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

La recuperación de batallas no implica recuperar el torneo al que pertenecen. Tampoco reconstruye votos históricos que solo existían en memoria o fueron sobrescritos antes de las migraciones.

## Documentos históricos

[Plan antiguo](../archivo/PLAN.md), [ejecución anterior](../archivo/EXECUTION_PLAN.md), [requerimientos anteriores](../archivo/UPDATES.md), [handoff de datos de julio](../archivo/HANDOFF_DATOS_2026-07-28.md). Conservan el trabajo previo, pero sus prioridades y cifras pueden estar desactualizadas.

## Registro de decisiones nuevas

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

Al aprobar una decisión nueva, registrarla aquí y desarrollar sus reglas en el documento de producto correspondiente. No abrir otro plan global que compita con este registro; el [Plan de trabajo](../PLAN_DE_TRABAJO.md) lo complementa y no lo sustituye.
