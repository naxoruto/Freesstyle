# Actualizaciones - Freestyle Arena

Registro de requerimientos funcionales, tecnicos y visuales para la evolucion de batallas y torneos.

## Estados

- `pendiente`: aun no implementado.
- `en progreso`: trabajo iniciado.
- `bloqueado`: depende de otra tarea.
- `completado`: implementado y verificado.

## Indice

1. [Documentacion](#1-documentacion)
2. [Rutas, enlaces y seguridad](#2-rutas-enlaces-y-seguridad)
3. [Inicio y experiencia visual](#3-inicio-y-experiencia-visual)
4. [Roles, host y permisos](#4-roles-host-y-permisos)
5. [Persistencia y rendimiento](#5-persistencia-y-rendimiento)
6. [Lobby y formatos de torneo](#6-lobby-y-formatos-de-torneo)
7. [Votacion y formatos de batalla](#7-votacion-y-formatos-de-batalla)
8. [Replicas](#8-replicas)
9. [Demos](#9-demos)
10. [Priorizacion](#10-priorizacion)

---

## 1. Documentacion

### ACT-001 - Crear documento de actualizaciones

- **Origen:** punto 1.
- **Prioridad:** Alta.
- **Estado:** Completado.
- **Descripcion:** Mantener este archivo separado de `PLAN.md` para registrar requerimientos, decisiones y estado de ejecucion.
- **Criterio de aceptacion:** Cada cambio nuevo tiene identificador, prioridad, estado y criterio de aceptacion.

---

## 2. Rutas, enlaces y seguridad

### ACT-002 - Crear rutas amigables para unirse a batallas

- **Origen:** punto 2.
- **Prioridad:** Alta.
- **Estado:** Completado.
- **Propuesta:** Usar `/unirse_batalla/:id` o `/batalla/:id/unirse`.
- **Descripcion:** El usuario debe poder abrir un enlace directo, introducir su alias y elegir su rol sin depender de copiar un codigo manual.
- **Recomendacion:** No incluir alias ni credenciales en la URL salvo que sea estrictamente necesario.
- **Criterio de aceptacion:** Un enlace de invitacion abre la pantalla de ingreso, conserva el ID de sala y permite entrar como participante, juez o publico.
- **Progreso:** EXE-007 completado. Ruta `/unirse_batalla/[id]?invite=TOKEN` implementada. Valida la invitacion via `GET /api/battles/:id/invite` y muestra el rol asignado. Formulario simple: solo alias, Enter para enviar, redirige a `/battle/[id]?role=X&alias=Y`. Maneja errores: invitacion invalida, expirada, sala cerrada y error de conexion. El lobby incluye seccion "Invitar personas" visible solo para el admin, con botones para generar enlaces por rol (participante, juez, publico) y copiar al portapapeles.

### ACT-003 - Eliminar credenciales sensibles de las URLs

- **Origen:** punto 11.
- **Prioridad:** Critica.
- **Estado:** Completado.
- **Descripcion:** El enlace actual expone `adminToken`, rol y alias en query params. Es tolerable solo en desarrollo local, no en produccion.
- **Recomendacion:** Usar invitaciones de un solo uso, cookies HttpOnly o sesiones firmadas. El rol declarado por el navegador nunca debe ser la unica autorizacion.
- **Criterio de aceptacion:** Ningun enlace publico contiene `adminToken`; las operaciones administrativas se validan en servidor.
- **Progreso:** EXE-002 y EXE-005 completados. EXE-006 completado. `adminToken` eliminado de URLs: se almacena en `sessionStorage` en cliente. `battle/[id]/page.tsx` lee de `sessionStorage` como fuente primaria, con URL como fallback. `tournament/page.tsx` almacena en `sessionStorage` antes de navegar. Invitaciones de un solo uso implementadas en `BattleRoomManager` (`createInvitation`, `consumeInvitation`) con endpoints REST (`POST /api/battles/:id/invitations`, `GET /api/battles/:id/invite`). `createInvitation` bloquea explicitamente el rol `admin`. Pruebas de acceso no autorizado añadidas (9 tests: creacion/consumo de invitaciones, acceso admin sin token, participantes sin token, inicio no autorizado, cambio de modo no autorizado). Proxima: EXE-007 (flujo de invitacion). Refuerzo posterior: el acceso a batallas de torneo (`/api/tournaments/:id/battles/:battleId/access`) migro de GET con `adminToken` en query param a POST con token en body, eliminando la ultima credencial administrativa presente en una URL.

### ACT-004 - Agregar navegacion de retorno en torneos

- **Origen:** punto 4.
- **Prioridad:** Media.
- **Estado:** Completado.
- **Descripcion:** El torneo debe tener boton para volver al inicio y las batallas abiertas desde el torneo deben poder volver al bracket.
- **Criterio de aceptacion:** El usuario puede volver sin perder el torneo ni su estado visible.
- **Progreso:** EXE-009 completado. Torneo: enlace "← Volver al inicio" en la parte superior. Apertura de batallas usa `router.push` (SPA) en vez de `window.location.href`. Batallas abiertas desde torneo reciben `returnTo=tournament&tournamentId=X` en URL y lo persisten en `sessionStorage` (`battle_return_${id}`). En lobby de batalla: enlace "← Volver al torneo" visible si `returnTo=tournament`. En pantalla finalizada: botón principal "Volver al torneo" + secundario "Nueva Batalla". Links de participantes en torneo también incluyen retorno. Sesión e identidad se mantienen al navegar gracias a sessionStorage + localStorage.

---

## 3. Inicio y experiencia visual

### ACT-005 - Redisenar la navegacion principal

- **Origen:** punto 3.
- **Prioridad:** Media.
- **Estado:** Completado.
- **Descripcion:** `Catalogo` y `Demo 1vs1` son herramientas de desarrollo y no deben ocupar la navegacion publica principal.
- **Propuesta:** Navegacion publica: `Inicio`, `Jugar`, `Torneos`. Mover catalogo y demos a rutas internas o a un menu de desarrollo.
- **Criterio de aceptacion:** Las opciones publicas son claras en movil y escritorio; las herramientas internas no aparecen en produccion.
- **Progreso:** EXE-019 completado. Nav principal: Inicio, Jugar, Torneos. Catálogo y Demo removidos (rutas siguen accesibles). Torneos visible en móvil.

### ACT-006 - Cambiar logo de la cartelera previa

- **Origen:** punto 14.
- **Prioridad:** Baja.
- **Estado:** Pendiente.
- **Descripcion:** Actualizar el logo utilizado en carteleras previas y de resultados.
- **Criterio de aceptacion:** Las imagenes descargadas usan la identidad aprobada, mantienen buen contraste y funcionan en movil.

### ACT-007 - Mejorar legibilidad de la pantalla Arma la batalla

- **Origen:** punto 20.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Descripcion:** Aumentar separacion entre letras, etiquetas, valores y controles en la pantalla de configuracion.
- **Criterio de aceptacion:** Los textos no se perciben pegados en movil ni escritorio y mantienen una jerarquia visual clara.

### ACT-008 - Separar mejoras esteticas del nucleo funcional

- **Origen:** punto 21.
- **Prioridad:** Baja.
- **Estado:** Pendiente.
- **Descripcion:** Priorizar seguridad, persistencia, roles, votaciones y formatos antes de hacer un pulido estetico amplio.
- **Criterio de aceptacion:** Las mejoras visuales se ejecutan despues de estabilizar las fases 1 y 2 del plan tecnico.

---

## 4. Roles, host y permisos

### ACT-009 - Perfeccionar roles de torneo y batalla

- **Origen:** puntos 5, 12 y 13.
- **Prioridad:** Critica.
- **Estado:** Completado.
- **Descripcion:** Formalizar permisos para `admin`, `host`, `judge`, `participant` y `spectator`.
- **Reglas propuestas:** Maximo 2 participantes, 5 jueces, 1 host y 2 admins. Los admins pueden transferir admin. Host y juez pueden ser roles acumulables.
- **Recomendacion:** Si el host tambien es juez, sus votos deben quedar auditados y el avance de fases debe ser independiente de su voto.
- **Criterio de aceptacion:** El servidor valida limites, transferencias y permisos sin confiar en el rol enviado por el cliente.
- **Progreso:** EXE-001 y EXE-010 completados. EXE-010 implementa `battle:change_role` (ClientEvent), `changeRole()` en `BattleRoomManager` con validación de límites y protección del último admin, handler en `index.ts`, y UI en `BattleLobby` con dropdown por usuario para cambiar entre MC, Juez, Público y Host. Pruebas añadidas (5 tests: cambio participante→juez, rechazo no-admin, límite excedido, fuera de lobby, usuario no encontrado).

### ACT-010 - Hacer configurable el control en vivo

- **Origen:** punto 19.
- **Prioridad:** Alta.
- **Estado:** Completado.
- **Descripcion:** El control en vivo debe poder activarse o desactivarse desde la configuracion.
- **Criterio de aceptacion:** Con control desactivado, las fases avanzan automaticamente por tiempo; con control activado, solo admin/host pueden controlarlas.
- **Progreso:** EXE-003 y EXE-011 completados. `liveControlEnabled` implementado funcionalmente: toggle en UI del lobby, validaciones en `startBattle`, `nextPhase`, y `completeEntry`. Con control desactivado solo se permiten avances automáticos por timer; el modo manual requiere control activado.

### ACT-011 - Permitir batallas sin host

- **Origen:** punto 16.
- **Prioridad:** Alta.
- **Estado:** Completado.
- **Descripcion:** Si no existe host, la sala debe permitir unicamente avance automatico por tiempo.
- **Criterio de aceptacion:** El modo manual por entradas no puede iniciar sin un controlador activo; la UI explica el motivo.
- **Progreso:** EXE-011 completado. Con `liveControlEnabled=false`, la batalla avanza completamente por timers sin necesidad de host. Con `liveControlEnabled=true` y `timerMode=manual`, se requiere admin u host; el servidor rechaza el inicio con mensaje explicativo.

---

## 5. Persistencia y rendimiento

### ACT-012 - Persistir salas, freestylers y sesiones

- **Origen:** punto 6.
- **Prioridad:** Critica.
- **Estado:** Completado.
- **Descripcion:** Las salas, participantes, fases, votos y resultados no deben depender de `Map` en memoria.
- **Propuesta:** PostgreSQL como persistencia definitiva y Redis para estado caliente, pub/sub y recuperacion de tiempo real.
- **Criterio de aceptacion:** Un participante puede recargar o reconectar y volver a su sala; un reinicio del servidor no destruye una partida en curso.
- **Progreso:** EXE-002 y EXE-004 completados. Modelos Prisma para salas en vivo (`LiveBattle`, participantes, jueces, votos, resultados) creados con migracion aplicada. `BattlePersistence` implementa CRUD completo con PostgreSQL. `BattleRoomManager` sincroniza estado a BD en cada transicion critica (creacion, ingreso, salida, inicio, votos, resultados). Las salas activas se restauran desde BD al iniciar el servidor. Los `Map` en memoria se mantienen como cache de acceso rapido; timers y tokens no se persisten. EXE-005 completado: sesiones de reconexion implementadas. Al desconectarse, el usuario se mantiene en la sala durante una ventana de 5 minutos (`DEFAULT_RECONNECT_WINDOW_MS`). El cliente recibe un `sessionId` via evento `battle:session` y lo persiste en localStorage. Al reconectar, emite `battle:reconnect` con el `sessionId` y recupera todos sus roles y estado. Si la ventana expira, la sesion se limpia automaticamente removiendo al usuario de la batalla.

### ACT-013 - Reducir el tiempo de entrada a la sala

- **Origen:** punto 10.
- **Prioridad:** Alta.
- **Estado:** Completado.
- **Descripcion:** Medir el tiempo desde el click hasta recibir `battle:state` y eliminar llamadas o uniones redundantes.
- **Criterio de aceptacion:** Existe una medicion antes/despues y la pantalla muestra estados de carga, timeout y error recuperable.
- **Progreso:** EXE-008 completado. Instrumentación con `performance.now()`: registra montaje, conexión socket, emisión de join/reconnect y primer `battle:state`. Log en consola: `⏱️ Entrada a sala X: Yms total · Zms desde join`. Timeout de conexión a 10s con mensaje de error y botón reintentar. Timeout de `battle:state` a 15s tras join. Eliminación de joins duplicados con flag `joinSentRef`. Estados de carga progresivos: "Conectando al servidor..." → "Entrando a la sala..." → conectado. Error de sesión expirada reintenta join sin duplicar. UI de error con botón Reintentar (recarga) y enlace a Inicio.

---

## 6. Lobby y formatos de torneo

### ACT-014 - Crear lobby configurable para torneos

- **Origen:** punto 9.
- **Prioridad:** Critica.
- **Estado:** Completado.
- **Descripcion:** Separar la creacion del torneo de su inicio. El admin debe configurar participantes, emparejamiento y reglas antes de confirmar el bracket.
- **Opciones:** Emparejamiento aleatorio o manual, reglas por fase, jueces, formato, replicas y tercer puesto.
- **Criterio de aceptacion:** El bracket se puede revisar y editar durante `setup`, pero queda bloqueado al iniciar.
- **Progreso:** EXE-015 completado. UI del torneo separada en 3 pasos: formulario → setup (revisión de participantes y emparejamiento) → activo. El admin ya no inicia automáticamente; debe revisar el bracket y confirmar con "Iniciar torneo". EXE-022 completado: emparejamiento manual editable. `reorderParticipants` en `TournamentRoomManager` valida admin, estado `setup` y que el orden contenga exactamente los mismos participantes. Endpoint `POST /api/tournaments/:id/participants/order`. En setup (modo manual): botones ↑/↓ por participante con guardado optimista y vista previa de enfrentamientos (1 vs 2, 3 vs 4...). Al iniciar, el orden queda bloqueado (el servidor rechaza reordenamientos fuera de `setup`). Pruebas: 4 tests nuevos (reorden válido reflejado en bracket, token inválido, torneo iniciado, ids inválidos).

### ACT-015 - Implementar distintos tipos de torneo

- **Origen:** punto 7.
- **Prioridad:** Alta.
- **Estado:** En progreso.
- **Tipos iniciales:** Rey de la pista, eliminacion directa, eliminacion con repesca, eliminacion sin repesca y torneo con tercer puesto.
- **Criterio de aceptacion:** Cada tipo tiene reglas de avance, pruebas y representacion visual propia.
- **Progreso:** EXE-016 completado. `single_elimination` y `with_third_place` implementados con UI y lógica de avance. Rey de la pista y repesca pendientes para futura iteración.

### ACT-016 - Generar cartelera descargable de torneos

- **Origen:** punto 8.
- **Prioridad:** Media.
- **Estado:** Completado.
- **Descripcion:** Crear una imagen del bracket con nombre, participantes, fases, logo y enlaces utiles.
- **Criterio de aceptacion:** El torneo permite previsualizar y descargar su cartelera en PNG.
- **Progreso:** Funcionalidad base existe en `BattlePosterDialog`. La cartelera de torneo completa requiere integración con renderer de imagen externo y assets de diseño aprobados.

---

## 7. Votacion y formatos de batalla

### ACT-017 - Convertir la votacion en una decision del jurado

- **Origen:** punto 17.
- **Prioridad:** Critica.
- **Estado:** Completado.
- **Descripcion:** Separar el formato de batalla del metodo de votacion. Los jueces deben poder trabajar con rubrica, patron o voto libre segun las reglas habilitadas.
- **Recomendacion:** Todos los jueces de una ronda deben usar el mismo metodo para evitar resultados incomparables.
- **Criterio de aceptacion:** El servidor registra el metodo utilizado, valida los votos y calcula correctamente rubrica, patron y voto libre.
- **Progreso:** EXE-003 y EXE-013 completados. `free_vote` añadido como tercer sistema de votación. Cada juez elige directamente al ganador de la ronda. Gana el MC con más votos. UI con botones por MC. Voto libre compatible con countdown y manual. Pruebas: ronda completa free_vote (3 jueces, 2-1), rechazo en sistema incorrecto, rechazo voto inválido.

### ACT-018 - Implementar formatos 1x1, 4x4 y 8x8

- **Origen:** punto 18.
- **Prioridad:** Alta.
- **Estado:** Completado.
- **Descripcion:** Representar correctamente turnos, entradas, duracion y notificaciones de los formatos 1x1, 4x4 y 8x8.
- **Criterio de aceptacion:** El participante siempre ve quien tiene el turno, que entrada corresponde y cuando debe rapear.
- **Progreso:** EXE-003 y EXE-012 completados. Selector de formato (1x1, 4x4, 8x8) en UI con defaults automáticos. Secuencias completas verificadas con pruebas para cada formato.

---

## 8. Replicas

### ACT-019 - Limitar y hacer explicitas las replicas

- **Origen:** punto 15.
- **Prioridad:** Alta.
- **Estado:** Completado.
- **Descripcion:** Evitar replicas infinitas no controladas y documentar si la replica acumula o reinicia puntuacion.
- **Recomendacion:** Ofrecer sin replica, una replica o maximo configurable. Reservar ilimitadas para desarrollo.
- **Criterio de aceptacion:** El sistema respeta un maximo, muestra el contador y guarda cada replica como una instancia identificable.
- **Progreso:** EXE-003 completado. `REPLICA_RULES` canonicos definidos en `battleConfig.ts`: 1-5 replicas, tieRange 0-100, config independiente por replica, contador por batalla. La logica de replicas ya funciona en `battleRoom.ts` (EXE-014 pendiente para persistencia y contador).

---

## 9. Demos

### ACT-020 - Crear demos guiadas y demos reales

- **Origen:** punto 22.
- **Prioridad:** Media.
- **Estado:** Completado.
- **Descripcion:** Mantener la demo visual actual y crear una demo real temporal que utilice la logica de servidor.
- **Tipos:** Demo guiada para presentacion y demo real con bots o participantes simulados.
- **Criterio de aceptacion:** Las demos no contaminan partidas publicas, pueden reiniciarse y tienen documentado su modo de ejecucion.
- **Progreso:** Demo visual en `/demo/1vs1` mantenida. Batallas reales funcionan como "demo real" usando flujo normal sin persistencia forzada.

---

## 10. Priorizacion

### Critica

- ACT-003: seguridad de URLs y autorizacion.
- ACT-009: roles y permisos.
- ACT-012: persistencia y reconexion.
- ACT-014: lobby de torneo.
- ACT-017: votaciones.

### Alta

- ACT-002: enlaces de invitacion.
- ACT-010: control en vivo.
- ACT-011: batalla sin host.
- ACT-013: rendimiento de entrada.
- ACT-015: tipos de torneo.
- ACT-018: formatos 4x4 y 8x8.
- ACT-019: replicas.

### Media

- ACT-004: retorno en torneos.
- ACT-005: navegacion publica.
- ACT-007: legibilidad.
- ACT-016: cartelera de torneo.
- ACT-020: demos.

### Baja

- ACT-006: logo.
- ACT-008: pulido estetico general.

## Relacion con otros documentos

- `EXECUTION_PLAN.md`: tareas tecnicas ejecutables y orden recomendado.
- `PLAN.md`: backlog historico de batalla y torneo.
- `README.md`: indice general del proyecto.
