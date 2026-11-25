# 5. Prioridades y decisiones

## Tres caminos posibles

| Camino | Qué entrega primero | Ventaja | Coste |
|---|---|---|---|
| **Flujos claros → perfiles → progresión — recomendado** | Crear y retomar eventos, después identidad común y XP. | El historial y los niveles se apoyan en participaciones más fiables. | La progresión visible llega después de la mejora operativa. |
| Perfiles primero | Foto, nombre, AKA y crew; más tarde mejorar eventos. | Da identidad visible pronto y responde a la nueva idea de comunidad. | El perfil tendría poco historial y los problemas de continuidad seguirían presentes. |
| Rediseño completo | Flujos, cuentas, crews y niveles en una sola entrega. | Permite una experiencia unificada desde el diseño. | Amplía mucho el alcance y aumenta dependencias con las tareas actuales. |

Los documentos y decisiones de producto pueden avanzar ahora. La implementación de identidad, persistencia y permisos debe reconciliarse con el trabajo de seguridad terminado, usando sus contratos finales.

## Prioridades de producto

| Prioridad | Propuesta | Resultado esperado | Dependencia |
|---|---|---|---|
| P1 | Batalla con resumen editable, acceso directo al lobby y requisitos por modo. | Menos pasos y bloqueos comprensibles. | Confirmar reglas finales de sala. |
| P1 | Torneo recuperable y retorno funcional desde cada batalla. | Continuar el mismo evento tras navegar o recargar. | Identidad/autorización y persistencia del evento. |
| P1 | Torneo actualizado con resultado y siguiente acción visibles. | Evitar que cada persona vea un estado distinto. | Fuente confirmada de resultados. |
| P1 | Validar cierre de tercer puesto y situaciones de empate. | Finales que corresponden a las reglas anunciadas. | Reproducción de hallazgos en aplicación. |
| P1 | Rey de pista con preparación coherente con voto de sala. | Comenzar con los miembros realmente necesarios. | Reconciliar lobby y reglas del servidor. |
| P2 | Rey de la pista como sesión abierta: elección del vencedor o fila determinada, combinadas con límite o infinito. | Admitir entradas y salidas, entender quién sigue y cuándo termina. | Acordar tipo de límite, reincorporación y tratamiento de desconexiones. |
| P2 | Perfil con foto, nombre, AKA y crew. | Identidad reutilizable entre encuentros. | Cuenta persistente y carga de imagen. |
| P2 | Historial y estadísticas por rol. | Reconocer aportes en los cuatro papeles. | Vincular cuenta y participación. |
| P3 | Nivel general, XP y resumen de progreso. | Motivar continuidad con reglas entendibles. | Actividad elegible y contabilización sin duplicados. |
| Después | Insignias, crews organizadas y ranking competitivo. | Más profundidad comunitaria. | Evidencia de uso y decisiones propias. |

## Primera entrega candidata

Elegir **solo la batalla individual** como primer alcance de mejora, tal como el orden solicitado: resumen de reglas, entrada directa al lobby, bloque de invitación y preparación acorde al modo. No obliga a implementar a la vez cuenta, avatar o niveles.

Una vez revisada esa propuesta, preparar el alcance de torneo y después el de Rey de pista. Perfiles y progresión se pueden diseñar en paralelo en documentos, manteniendo contratos pendientes separados de decisiones aprobadas.

Este orden es una recomendación para conversar, no una asignación de tareas ni un compromiso de entrega.

## Decisiones registradas

| Tema | Estado |
|---|---|
| Carpeta independiente para brainstorming | Solicitado por el usuario; documentos guardados aquí. |
| Revisar batalla → torneo → Rey de pista | Solicitado por el usuario; revisión escrita en ese orden. |
| Perfil con foto, nombre, AKA y crew | Solicitado como dirección de producto. |
| Reconocer MC, juez, host y viewer | Solicitado como dirección de producto. |
| Un nivel general con estadísticas por rol | Confirmado por el usuario. |
| En Rey de la pista votan los concursantes ajenos al duelo actual | Confirmado en la conversación; el público externo no vota. |
| Quienes ya perdieron siguen votando mientras permanezcan en la sesión | Confirmado por el usuario. |
| Dos formas de jugar: el vencedor elige o fila determinada | Solicitado por el usuario. Detalles de selección, ausencias y cierre en elaboración. |
| Sesión abierta con entradas y salidas durante el juego | Confirmado por el usuario; sustituye la recomendación anterior de lista cerrada. |
| Dos duraciones: con límite o infinito hasta que todos se vayan | Solicitado por el usuario; combinables con ambas formas de elegir rival. Tipo y valor del límite pendientes. |
| XP de ejemplo y curva de nivel | Propuesta sin aprobar. |
| Crew como texto libre inicialmente | Recomendación sin aprobar. |
| Invitados sin progreso persistente inicial | Recomendación sin aprobar. |
| Implementación de estas mejoras | No iniciada; fuera del alcance de esta revisión. |

## Próximas conversaciones

Resolver una decisión por vez:

1. Batalla: ¿la creación rápida con resumen editable refleja la experiencia deseada?
2. Torneo: ¿se organizará en un solo escenario o con varias batallas simultáneas?
3. Rey de la pista: ¿qué límite se podrá elegir? Después, acordar reincorporación del perdedor y margen de reconexión antes de declarar sesión vacía.
4. Perfil: ¿cuenta opcional para entrar y necesaria para guardar progreso?
5. Niveles: ¿qué ritmo de avance se siente justo para cada rol?

Estas preguntas quedan en el documento para guiar el brainstorming; no bloquean la revisión ya solicitada ni requieren resolver todo de inmediato.

## Verificación de esta revisión

- Se distinguió lo observado en archivos de las mejoras propuestas.
- No se calificó una lectura de código como prueba de navegador.
- Se reconocieron funciones existentes para evitar repetirlas como nuevas.
- Los posibles problemas de continuidad, tercer puesto y voto de sala quedaron pendientes de reproducción.
- La decisión confirmada de nivel general se mantuvo en todas las propuestas.
- Los números de XP, umbrales y límites están identificados como ejemplos sin aprobar.
- No se ejecutaron migraciones, builds, servicios ni pruebas de aplicación para producir estos documentos.

## Archivos centrales para la siguiente revisión

`apps/web/src/app/page.tsx`, `apps/web/src/components/BattleLobby.tsx`, `apps/web/src/components/BattleModeSelector.tsx`, `apps/web/src/app/tournament/page.tsx`, `apps/web/src/app/battle/[id]/page.tsx`, `apps/server/src/rooms/tournamentRoom.ts`, `apps/server/src/rooms/battleRoom.ts`, `apps/server/src/index.ts`, `packages/shared/src/battleConfig.ts`, `packages/shared/src/identity.ts` y `apps/server/prisma/schema.prisma`.

Releerlos después de que concluyan las tareas paralelas antes de convertir este borrador en especificaciones de implementación.
