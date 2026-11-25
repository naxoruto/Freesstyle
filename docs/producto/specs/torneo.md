# Especificación — Torneo

> **Estado:** especificación de producto; recorrido de inscripción confirmado el 25 de noviembre de 2026 (Fase 2 del [Plan de trabajo](../../PLAN_DE_TRABAJO.md)). La implementación web sigue pendiente según el plan de torneo.
>
> **Origen:** decisiones de producto confirmadas el 25 de noviembre de 2026 (CAMBIOS `DEC-012`…`DEC-014`, `DEC-016`, `DEC-021`).

## 1. Objetivo

Un torneo **recuperable y claro**: identidad del evento (nombre, logo y organizador), inscripción por enlace y a mano, sorteo revisable con auditoría, cuadro en vivo con panel «Ahora / Después», repesca por suplentes y retorno desde cada batalla.

## 2. Decisiones confirmadas

| Tema | Decisión |
|---|---|
| Tipos de torneo | Eliminación directa, con tercer puesto y doble eliminación. **Rey de la pista queda fuera** del formulario (DEC-013) |
| Identidad | **Nombre obligatorio**; logo y organizador **opcionales** (DEC-012) |
| Creación | Elegir **tipo primero** y adaptar los pasos (C19); campo de participantes **vacío** + botón «Cargar ejemplo» (C18) |
| Recorrido | **Crear → inscribir y confirmar → sortear e iniciar**. Después de crear, el organizador llega a la inscripción guiada (DEC-021) |
| Reglas | La configuración de las batallas se fija **antes de compartir la inscripción**; el organizador puede cambiarla hasta iniciar el torneo. Quien abre el enlace ve siempre las reglas vigentes (DEC-021) |
| Capacidad | Cuadros de **4, 8 y 16** (C20) |
| Inscripción | **Autoinscripción por enlace/código** (invitado con nombre o cuenta, según DEC-004) **+ agregado manual** del organizador (A12). El organizador puede quitar o mover inscritos antes de iniciar (DEC-021) |
| Orden del cuadro | **Sorteo + ajuste manual**; cada reorden queda **auditado** (quién y cuándo) para evitar trampas (C21) |
| Escenario | **Una sola mesa**: se juega una batalla a la vez (batallas simultáneas quedan para más adelante) |
| Repesca | **Lista de reserva (suplentes)**: si alguien no llega, entra el siguiente suplente (C25) |
| Recuperación | El torneo se **persiste y recupera** tras reinicio (TOR-01) |

## 3. Flujo de creación

1. Inicio → «Crear batalla» → **Torneo**.
2. Elegir **tipo** (eliminación directa / con tercer puesto / doble eliminación).
3. **Nombre** (obligatorio) + **logo** y **organizador** (opcionales), **capacidad** (4, 8 o 16) y reglas de las batallas.
4. Crear el torneo y entrar a **Inscripción**, sin mostrar aún el cuadro como pantalla principal.
5. Compartir el enlace/código y agregar participantes a mano si hace falta. Mostrar titulares y suplentes provisionales; permitir al organizador mover o quitar inscripciones.
6. **Confirmar titulares**: cerrar la inscripción pública y fijar la lista que se sorteará. El organizador aún puede corregirla antes de iniciar.
7. **Sortear y revisar**: sortear el orden, reordenar a mano (con auditoría) y **confirmar el cuadro** antes de iniciar. Si cambia la lista tras el sorteo, volver a revisarlo antes de iniciar.

## 4. Inscripción

- El torneo tiene un **enlace de invitación** (como la batalla). Quien lo abre se inscribe con su nombre (invitado o cuenta).
- Antes de inscribirse, la persona ve la identidad del torneo y las reglas vigentes. Después ve su inscripción y su estado provisional (titular o suplente), además de esas reglas; no necesita ver la lista completa.
- El organizador también puede **agregar a mano** a quien no use el enlace.
- Los primeros `N` (tamaño del cuadro) son **titulares**; los siguientes quedan como **suplentes** en orden de inscripción.
- Antes de iniciar, el organizador **confirma** quiénes juegan (A13): puede mover a alguien de titular a suplente y viceversa, o quitar una inscripción.
- Al confirmar titulares, se cierra la inscripción pública. El organizador conserva la capacidad de corregir la lista hasta iniciar el torneo.
- Si una corrección deja menos titulares que la capacidad elegida, el inicio queda pendiente hasta completar la lista. La inscripción manual del organizador sigue disponible.
- Las reglas se fijan antes de compartir el enlace. Si el organizador las cambia antes del inicio, el enlace muestra la versión vigente y señala que fueron actualizadas.

## 5. Sorteo y cuadro

- **«Sortear»** arma el cuadro (aleatorio). El organizador puede **reordenar** a mano.
- Cada reorden se **registra** (auditoría: quién, a quién y cuándo). Visible para detectar trampas.
- **«Iniciar»** es un paso separado del sorteo (C21): el cuadro queda confirmado y visible para todos.

## 6. En vivo

- Panel **«Ahora / Después»**: la batalla actual destacada y la siguiente anunciada.
- Cuadro consultable (móvil: lista; escritorio: cuadro amplio).
- Cada batalla se abre desde el torneo y **vuelve al mismo torneo** conservando el contexto (C22).
- El cuadro se **actualiza en vivo** cuando avanza un resultado (C23).
- Configuración de batalla **visible** al abrir una sala (C24).

## 7. Repesca por inasistencia

- Si un titular **no llega** (confirmado por el organizador), entra el **siguiente suplente** en su lugar (mismo puesto del cuadro).
- La ausencia y la sustitución quedan **registradas** (auditoría) y no otorgan XP por batalla disputada.
- Sin suplentes disponibles, el organizador decide el tratamiento (no se asume pase automático).

## 8. Cierre

- Campeón y posiciones visibles al terminar.
- Resultado idempotente: el avance del cuadro usa el resultado de la batalla, no el registro manual como vía principal.

## 9. Cambios de modelo (TOR-01)

- **Persistencia del torneo**: nombre, logo, organizador, tipo, participantes (titulares/suplentes), fases, resultados, suplentes y auditoría de reordenes y sustituciones.
- **Recuperación**: al reiniciar el servidor, los torneos en curso se restauran (como las batallas).
- **Resultados idempotentes**: el avance del cuadro se calcula una sola vez por batalla.

## 10. Componentes y archivos afectados

- `apps/web/src/app/tournament/page.tsx` — rediseño completo del flujo.
- `apps/server/src/rooms/tournamentRoom.ts` — persistencia, suplentes, auditoría.
- `apps/server/src/index.ts` — endpoints de inscripción y recuperación.
- `packages/shared/src/types.ts` — contrato de torneo ampliado.
- `apps/server/prisma/schema.prisma` — modelo de torneo.

## 11. Criterios de aceptación

- Recorrer un torneo de 4 y otro de 8: crear, inscribir por enlace y a mano, sortear, reordenar (con auditoría), iniciar, abrir salas, volver, recargar y ver el cuadro en vivo.
- Tras crear, el organizador llega a la inscripción guiada; puede quitar y mover participantes, confirma titulares y recién entonces accede al sorteo. La inscripción pública se cierra al confirmar.
- Quien se inscribe ve su nombre, su estado provisional y las reglas vigentes. Si las reglas cambian antes del inicio, el enlace muestra la actualización.
- Un suplente reemplaza a un ausente y la sustitución queda registrada.
- Tras recargar, el torneo se recupera en el mismo estado.
- Todos ven los mismos resultados; el organizador identifica la siguiente acción sin ayuda.

## 12. Fuera de alcance (Fase 2)

- Batallas simultáneas (varias salas a la vez).
- Rey de la pista (Fase 3).
- Perfil, cuentas y progresión (Fase 4–5) — la inscripción usa invitado o cuenta existente.
- Ranking competitivo.
