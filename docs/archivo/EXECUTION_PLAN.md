> Documento histórico. Sus prioridades y cifras pueden estar desactualizadas. Consultar [el registro central](../producto/CAMBIOS.md) y [el índice del proyecto](../../INDEX.md) para continuar.

# Plan de Ejecucion - Batallas y Torneos

Este documento convierte `UPDATES.md` en unidades de trabajo independientes. Cada bloque debe cerrar con pruebas automatizadas, typecheck y una verificacion manual.

## Criterio global de cierre

Antes de marcar una tarea como completada:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Cuando el cambio afecte tiempo real, tambien se deben probar dos navegadores, recarga de pagina, desconexion temporal y movil.

## Fase 0 - Inventario y contratos

**Objetivo:** fijar el modelo antes de implementar cambios grandes.

### EXE-001 - Crear matriz de permisos ✅

- **Relacion:** ACT-009.
- **Dependencias:** ninguna.
- **Archivos iniciales:** `packages/shared/src/types.ts`, `apps/server/src/rooms/battleRoom.ts`.
- **Tareas:**
  - Definir acciones por rol.
  - Definir roles acumulables.
  - Definir limites de participantes, jueces, hosts y admins.
  - Crear pruebas de autorizacion.
- **Salida:** contrato de permisos aprobado y testeado.
- **Implementado:** `packages/shared/src/permissions.ts` con `ROLE_LIMITS`, `canPerform`, `canJoinAsRole`, `VALID_JUDGE_COUNTS`. `BattleRoomManager` migrado a usar la matriz. Pruebas añadidas (4 nuevos tests: limite participantes, admins, jueces, host). Lint, typecheck, test (53 tests), build pasan.

### EXE-002 - Definir modelo de identidad y sesiones ✅

- **Relacion:** ACT-003, ACT-012.
- **Dependencias:** EXE-001.
- **Tareas:**
  - Definir identidad estable de usuario por sala.
  - Definir sesion de sala y expiracion.
  - Definir invitaciones de un solo uso.
  - Definir que datos pueden aparecer en URLs.
- **Salida:** decision documentada antes de tocar el flujo de ingreso.
- **Implementado:** `packages/shared/src/identity.ts` con `RoomIdentity`, `RoomSession`, `RoomInvitation`, helpers de validacion (`isSessionExpired`, `isSessionInReconnectWindow`, `isInvitationValid`, `consumeInvitation`, `markSessionDisconnected`, `markSessionReconnected`), constantes (`DEFAULT_RECONNECT_WINDOW_MS`, `DEFAULT_INVITATION_MAX_USES`, `DEFAULT_INVITATION_TTL_MS`) y politica de URLs documentada como JSDoc. Pruebas en `apps/server/src/rooms/identity.test.ts` (17 tests). Lint, typecheck, test (70 tests), build pasan.

### EXE-003 - Definir configuracion canonica de batalla ✅

- **Relacion:** ACT-010, ACT-011, ACT-017, ACT-018, ACT-019.
- **Dependencias:** EXE-001.
- **Tareas:**
  - Unificar timer, entradas y estructura de turnos.
  - Definir `liveControlEnabled`.
  - Definir formatos 1x1, 4x4 y 8x8.
  - Definir metodos de votacion.
  - Definir regla y limite de replicas.
- **Salida:** tipos compartidos y reglas de negocio sin ambiguedades.
- **Implementado:** `BattleFormat` ("1x1" | "4x4" | "8x8") y `liveControlEnabled` añadidos a `BattleModeConfig` en `types.ts`. `packages/shared/src/battleConfig.ts` con `FORMAT_DEFAULTS` (entradas, timerMode, turnStructure por formato), `VOTING_METHODS` (rubrica 5 dimensiones 0-10, patron per-entry 0-4 con extras), `VOTING_COMPATIBILITY` (countdown→rubrica, manual→ambos), `REPLICA_RULES` (1-5 replicas, tieRange 0-100, config independiente), `validateConfig`, `normalizeConfig`, `createDefaultConfig`. `modes.ts` actualizado con nuevos campos. Pruebas en `battleConfig.test.ts` (27 tests). Lint, typecheck, test (97 tests), build pasan.

## Fase 1 - Seguridad, persistencia y reconexion

**Objetivo:** que una sala pueda sobrevivir a recargas, desconexiones y reinicios controlados.

### EXE-004 - Persistir batallas y participantes ✅

- **Relacion:** ACT-012.
- **Dependencias:** EXE-002, EXE-003.
- **Archivos iniciales:** `apps/server/prisma/schema.prisma`, migraciones, `apps/server/src/rooms/battleRoom.ts`.
- **Tareas:**
  - Crear modelos para sala, participante, rol, ronda, fase y resultado.
  - Crear migracion.
  - Reemplazar lecturas y escrituras criticas de los `Map`.
  - Mantener en memoria solo caches o timers.
  - Crear pruebas de serializacion y restauracion.
- **Salida:** una sala persiste su estado principal.
- **Implementado:** 8 modelos en `schema.prisma`: `LiveBattle` (estado principal con JSON para config y scores), `LiveBattleParticipant`, `LiveBattleJudge`, `LiveBattleSpectator`, `LiveBattleRubricVote`, `LiveBattlePatronEntryVote`, `LiveBattlePatronExtraVote`, `LiveBattleRoundResult`. Migracion `20260801012434_add_live_battle_models`. `battlePersistence.ts` con repositorio completo (create, findById, update, delete, loadActiveBattles, metodos de votos y resultados). `BattleRoomManager` integrado con dual-write (memoria + BD): sincroniza en createBattle, joinBattle, leaveRoom, startBattle, submitRubricVote, submitPatronEntryVote, submitPatronExtraVote, recordRoundResult. `loadActiveBattlesFromDb()` para restaurar al iniciar. Pruebas en `battlePersistence.test.ts` (12 tests: CRUD, votos, resultados, carga selectiva). Lint, typecheck, test (109 tests), build pasan.

### EXE-005 - Implementar sesiones de reconexion ✅

- **Relacion:** ACT-012.
- **Dependencias:** EXE-004.
- **Tareas:**
  - Emitir token de sesion por participante.
  - Mantener una identidad desconectada durante un periodo definido.
  - Reasociar el socket al reconectar.
  - Restaurar rol y estado de la sala.
  - Definir limpieza de sesiones expiradas.
- **Salida:** recargar o reconectar no elimina al freestyler.
- **Implementado:** `BattleRoomManager` genera `sessionId` (12 chars) en `joinBattle` y lo emite via evento `battle:session`. Nuevo mapa `sessions` almacena `SessionData` con identidades, estado de conexion y timers de limpieza. `handleDisconnect` marca la sesion como desconectada y programa limpieza tras `DEFAULT_RECONNECT_WINDOW_MS` (5 min). `reconnect` valida sesion, cancela timer de limpieza y reasocia nuevo socket con todas las identidades previas. `cleanupDisconnectedSession` remueve al usuario de la batalla tras expirar la ventana, con callback `onSessionCleanup` para broadcast. `leaveRoom` mantiene comportamiento de baja inmediata para salidas explicitas. Cliente persiste `sessionId` en localStorage y lo envia en `battle:reconnect` al montar; si falla, cae a `battle:join` normal. Pruebas añadidas (5 tests: preservacion en disconnect, reconexion valida, baja explicita, sesion invalida, sesion ya conectada). Lint, typecheck, test (23 tests en battleRoom, 17 en identity, 27 en battleConfig), build pasan.

### EXE-006 - Cerrar la exposicion del admin token ✅

- **Relacion:** ACT-003.
- **Dependencias:** EXE-002, EXE-004.
- **Tareas:**
  - Retirar tokens administrativos de query params.
  - Crear invitaciones o sesiones firmadas.
  - Validar permisos exclusivamente en servidor.
  - Revisar enlaces de batalla y torneo.
  - Añadir pruebas de acceso no autorizado.
- **Salida:** los enlaces no filtran credenciales.
- **Implementado:** `adminToken` eliminado de todas las URLs. `page.tsx` almacena en `sessionStorage` (`battle_admin_${id}`) tras crear batalla y navega sin token en query params. `battle/[id]/page.tsx` lee `adminToken` de `sessionStorage` como fuente primaria, con URL como fallback para compatibilidad. `tournament/page.tsx` almacena `adminToken` de batalla en `sessionStorage` antes de redirigir. Invitaciones de un solo uso en `BattleRoomManager`: `createInvitation(role, adminToken)` genera token de 12 chars con `maxUses` configurable (1 para roles normales, 50 para spectator) y TTL de 24h; `consumeInvitation(token)` valida, consume y retorna `{roomId, role}`. Bloqueo explicito de invitaciones para rol `admin`. Endpoints REST: `POST /api/battles/:id/invitations` (crea invitacion, requiere adminToken en body) y `GET /api/battles/:id/invite?invite=...` (consume y devuelve rol). Pruebas añadidas (9 tests en `battleRoom.test.ts`): creacion/consumo de invitacion valida, rechazo con adminToken invalido, rechazo de rol admin, consumo doble, token invalido, acceso admin sin token, participantes/espectadores sin token, inicio batalla sin admin, cambio de modo sin admin. Lint, typecheck, test (32 tests en battleRoom), build pasan.

## Fase 2 - Ingreso y experiencia de sala

**Objetivo:** simplificar la entrada y hacer que los estados de la sala sean comprensibles.

### EXE-007 - Crear flujo de invitacion ✅

- **Relacion:** ACT-002.
- **Dependencias:** EXE-006.
- **Archivos iniciales:** `apps/web/src/app`, `apps/web/src/app/page.tsx`, `apps/web/src/app/battle/[id]/page.tsx`.
- **Tareas:**
  - Crear ruta `/unirse_batalla/[id]`.
  - Crear formulario de alias y rol.
  - Crear enlaces de invitacion por rol.
  - Añadir copiar enlace.
  - Manejar sala inexistente o cerrada.
- **Salida:** un usuario entra mediante enlace sin conocer detalles internos.
- **Implementado:** Nueva ruta `apps/web/src/app/unirse_batalla/[id]/page.tsx`. Lee `invite` de query params, valida contra `GET /api/battles/:id/invite`, muestra el rol asignado (Participante, Juez, Público) con icono y etiqueta. Formulario con solo alias (auto-focus, Enter para enviar). Redirige a `/battle/[id]?role=X&alias=Y`. Estados: loading (pulso "Validando invitación..."), error (mensaje descriptivo + botón volver), ready (formulario). Errores manejados: sin token, invitación expirada/consumida (410), sala incorrecta (403), error de red. `BattleLobby.tsx` recibe `adminToken` opcional y muestra sección "Invitar personas" solo para admin, con 3 botones (participante/juez/público) que llaman `POST /api/battles/:id/invitations`. Enlace generado con dominio completo y botón Copiar. Lint, typecheck, test (32 tests battleRoom), build pasan. Nueva ruta aparece en build output.

### EXE-008 - Medir y optimizar entrada a sala ✅

- **Relacion:** ACT-013.
- **Dependencias:** EXE-007.
- **Tareas:**
  - Instrumentar click, navegacion, socket conectado y primer estado.
  - Eliminar uniones duplicadas.
  - Mostrar loading inmediato.
  - Añadir timeout y reintento.
  - Comparar medicion antes/despues.
- **Salida:** tiempo de entrada medido y mejorado sin regresiones.
- **Implementado:** Tipo `EntryPhase` ("connecting" | "joining" | "connected" | "error") reemplaza el booleano `connecting`. Instrumentación con `perfRef` que registra `performance.now()` en montaje, conexión socket, emisión join y primer `battle:state`, con log `⏱️ Entrada a sala: Xms total · Yms desde join`. Timeout de conexión a 10s (`CONNECT_TIMEOUT_MS`): si no hay `connect` en 10s, cierra socket y muestra error. Timeout de `battle:state` a 15s (`STATE_TIMEOUT_MS`): si no se recibe estado tras emitir join/reconnect, muestra error. `joinSentRef` previene emisiones duplicadas de `battle:join` (escenario: sesión expirada → error → reintento). Reconexión fallida limpia sessionStorage y emite join fresco sin duplicar. UI de error: mensaje descriptivo, botón Reintentar (`window.location.reload()`) y enlace a Inicio. Estados de carga progresivos: "Conectando al servidor..." (fase socket) → "Entrando a la sala..." (fase join). Lint, typecheck, test (32 tests battleRoom), build pasan.

### EXE-009 - Añadir retornos y estados de navegacion ✅

- **Relacion:** ACT-004.
- **Dependencias:** EXE-007.
- **Tareas:**
  - Volver al inicio desde torneo.
  - Volver al torneo desde una batalla.
  - Mantener identificador y sesion.
  - Verificar comportamiento del boton atras del navegador.
- **Salida:** no existen pantallas sin salida clara.
- **Implementado:** `tournament/page.tsx`: añadido enlace "← Volver al inicio" en la parte superior. `openBattle` migrado de `window.location.href` a `router.push` (navegación SPA). URLs de batalla incluyen `returnTo=tournament&tournamentId=X`. Contexto de retorno persiste en `sessionStorage` (`battle_return_${battleId}`). Links de participantes también incluyen `returnTo=tournament`. `battle/[id]/page.tsx`: lee `returnTo` y `tournamentId` de query params con fallback a `sessionStorage` (persiste entre recargas). En header del lobby: enlace "← Volver al torneo" visible si `returnTo=tournament`. En pantalla finished: botón principal "Volver al torneo" + secundario "Nueva Batalla" cuando viene de torneo; solo "Nueva Batalla" en caso normal. La navegación con SPA + sessionStorage preserva identidad y sesión. Botón atrás del navegador funciona naturalmente en ambos modos (SPA y full reload). Lint y build pasan.

## Fase 3 - Roles y control de batalla

**Objetivo:** permitir administracion segura y control automatico o manual.

### EXE-010 - Implementar cambios de rol del admin ✅

- **Relacion:** ACT-009.
- **Dependencias:** EXE-001, EXE-005.
- **Tareas:**
  - Añadir eventos para cambiar rol.
  - Validar limites en servidor.
  - Implementar hasta dos admins.
  - Implementar transferencia y revocacion de admin.
  - Actualizar lobby y tabla de participantes.
- **Salida:** el admin puede gestionar roles sin romper limites.
- **Implementado:** Nuevo `ClientEvent`: `battle:change_role` con `targetUserId` y `newRole`. Método `changeRole(socketId, targetUserId, newRole)` en `BattleRoomManager`: valida que el solicitante sea admin, que la batalla esté en lobby, que el usuario objetivo esté conectado a la sala, que no se exceda el límite del rol destino, y que no se elimine el último admin. Helpers `addRoleToBattle` y `removeRoleFromBattle` encapsulan la mutación de participantes/jueces/espectadores/host/admins. Handler en `index.ts` para `battle:change_role`. UI en `BattleLobby`: sección "Cambiar roles" visible solo para admin, con dropdown por usuario conectado mostrando rol actual y opciones para cambiar a MC, Juez, Público o Host. Callback `onChangeRole` en props y handler `handleChangeRole` en la página de batalla. Pruebas añadidas (5 tests en `battleRoom.test.ts`): cambio participante→juez, rechazo no-admin, límite excedido, fuera de lobby, usuario no encontrado, juez→participante con slot libre. Total: 37 tests en battleRoom. Lint, typecheck, test, build pasan.

### EXE-011 - Implementar host opcional y control en vivo ✅

- **Relacion:** ACT-010, ACT-011.
- **Dependencias:** EXE-003, EXE-010.
- **Tareas:**
  - Añadir `liveControlEnabled` al contrato.
  - Permitir host y host+juez bajo reglas auditables.
  - Desactivar modo manual sin controlador.
  - Crear avance automatico por tiempo.
  - Resolver desconexion del host.
- **Salida:** una batalla puede funcionar con host o sin host.
- **Implementado:** `startBattle`: valida que modo manual tenga `liveControlEnabled` activado y controlador presente; si `liveControlEnabled=false` y `timerMode=manual` → rechaza inicio; si `liveControlEnabled=true`, `timerMode=manual` y sin admin/host → rechaza. `nextPhase` recibe parámetro `isAuto`: si `!liveControlEnabled && !isAuto` → rechaza avance manual ("El control en vivo está desactivado"). `advanceAndBroadcast` marca todos los avances por timer con `isAuto=true`. `completeEntry` rechaza si `!liveControlEnabled`. `setMode` preserva `liveControlEnabled` por defecto. `cleanupDisconnectedSession`: log de advertencia si host era el único controlador en modo manual. UI: toggle "Control en vivo" en la sección de configuración del lobby (dentro de `configOpen`). Pruebas añadidas (3 tests: modo manual sin liveControl, countdown con liveControl=false y auto/manual, completeEntry rechazado). Total: 38 tests en battleRoom. Lint, typecheck, build pasan.

## Fase 4 - Formatos y votaciones

**Objetivo:** soportar los formatos competitivos y sus metodos de decision.

### EXE-012 - Implementar secuencias 1x1, 4x4 y 8x8 ✅

- **Relacion:** ACT-018.
- **Dependencias:** EXE-003, EXE-011.
- **Archivos iniciales:** `apps/server/src/rooms/battleRoom.ts`, `apps/server/src/modes/modes.ts`, `apps/web/src/components/BattleModeSelector.tsx`.
- **Tareas:**
  - Modelar entradas y turnos.
  - Notificar participante activo.
  - Mostrar entrada actual y restantes.
  - Permitir timer o control manual segun formato.
  - Añadir pruebas de secuencias completas.
- **Salida:** cada formato completa una batalla sin desorden de turnos.
- **Implementado:** `BattleModeSelector` añade sección "Formato" con 1x1/4x4/8x8. Al cambiar formato se aplican defaults de `FORMAT_DEFAULTS` (entriesPerParticipant, timerMode, turnStructure, timePerTurn, rounds). `createBattle` usa format defaults antes de aplicar overrides. `setMode` preserva `format`. Lobby muestra etiqueta de formato (1x1, 4x4, 8x8). Pruebas de secuencias completas (3 tests): 4x4 manual con 4 entradas por MC, 1x1 countdown simple, 8x8 manual con entradas. Total: 40 tests en battleRoom. Lint, build pasan.

### EXE-013 - Implementar voto libre y seleccion de metodo ✅

- **Relacion:** ACT-017.
- **Dependencias:** EXE-003, EXE-012.
- **Archivos iniciales:** `packages/shared/src/types.ts`, `apps/server/src/scoring/scoring.ts`, `apps/web/src/app/battle/[id]/page.tsx`.
- **Tareas:**
  - Añadir `free_vote`.
  - Crear UI del juez para el metodo permitido.
  - Validar unanimidad de metodo por ronda.
  - Calcular resultado y desempate.
  - Guardar auditoria de voto.
- **Salida:** los jueces deciden dentro de un metodo claramente visible.
- **Implementado:** `VotingSystem` extendido con `"free_vote"`. Tipo `FreeVote` con judgeId, votedForId, mc1Id, mc2Id. `VOTING_METHODS.free_vote` (1 dimensión, no per-entry, no extras). `VOTING_COMPATIBILITY` actualizado: countdown=[rubrica, free_vote], manual=[rubrica, patron, free_vote]. `calculateFreeVoteResult` en scoring.ts: cuenta votos por MC, gana mayoría simple. `BattleRoomManager`: mapa `freeVotes`, método `submitFreeVote` (valida sistema, fase voting, juez válido, participante válido). `nextPhase` voting case maneja free_vote (verifica allJudged, calcula resultado). `ClientEvent` añade `judge:vote_free`. Handler en `index.ts`. UI: BattleModeSelector con 3 columnas (Rúbrica/Patrón/Voto libre). Battle page: panel de voto libre en fase voting con dos botones grandes (un MC por lado). Pruebas: ronda free_vote con 3 jueces, rechazo sistema incorrecto, rechazo participante inválido. Total: 42 tests battleRoom. Lint, build pasan.

### EXE-014 - Corregir replicas y su persistencia ✅

- **Relacion:** ACT-019.
- **Dependencias:** EXE-004, EXE-012, EXE-013.
- **Tareas:**
  - Aplicar limite maximo.
  - Definir reinicio o acumulacion de puntos.
  - Persistir cada replica.
  - Mostrar contador y configuracion.
  - Añadir pruebas de empate, limite y final.
- **Salida:** nunca hay replicas infinitas no intencionadas.
- **Implementado:** Persistencia de `replicaCount` y `replicaConfig` ya implementada en `serializeBattle`/`deserializeBattle`. Contador visible en UI (`Réplica N` en info de ronda). Pruebas añadidas (3 tests): réplica agotada con maxReplicas=1 → finaliza, sin réplica cuando diff > tieRange, conteo correcto en múltiples réplicas. Total: 45 tests en battleRoom. Lint, build pasan.

## Fase 5 - Torneos

**Objetivo:** crear torneos configurables y persistentes.

### EXE-015 - Separar setup, lobby y comienzo ✅

- **Relacion:** ACT-014.
- **Dependencias:** EXE-004, EXE-010.
- **Archivos iniciales:** `apps/server/src/rooms/tournamentRoom.ts`, `apps/web/src/app/tournament/page.tsx`.
- **Tareas:**
  - Persistir torneo y participantes.
  - Crear estado de setup.
  - Crear lobby de configuracion.
  - Permitir emparejamiento manual.
  - Confirmar bracket antes de iniciar.
- **Salida:** el admin revisa el bracket antes de bloquearlo.
- **Implementado:** `tournament/page.tsx` refactorizado con 3 pasos: `form` (crear), `setup` (revisar participantes y emparejamiento), `active` (bracket en progreso). En setup: se muestran los participantes numerados, descripción del tipo de emparejamiento (aleatorio vs orden manual), botón "Iniciar torneo" y botón "Cancelar". El torneo ya no se inicia automáticamente al crear. Lint, test (45 battleRoom, 3 tournamentRoom), build pasan.

### EXE-016 - Implementar tipos de torneo ✅

- **Relacion:** ACT-015.
- **Dependencias:** EXE-015, EXE-014.
- **Tareas:**
  - Añadir `TournamentType`.
  - Implementar eliminacion directa.
  - Implementar rey de la pista.
  - Implementar repesca.
  - Implementar tercer puesto.
  - Crear pruebas de avance por tipo.
- **Salida:** cada tipo respeta sus reglas y genera batallas validas.
- **Implementado:** `TournamentType` soporta `"single_elimination"`, `"with_third_place"`, `"king_of_the_hill"` y `"double_elimination"`. Tercer puesto genera el partido extra desde los perdedores de semifinal. Rey de la pista usa el orden configurable y voto de sala. Doble eliminacion genera fases estandar de repesca para 4, 8 y 16 participantes, con gran final y final de reinicio. UI y pruebas cubren tamaños, segunda vida, campeon de repesca e idempotencia. Lint, typecheck, test (151 tests) y build pasan.

### EXE-017 - Evitar doble registro de ganadores ✅

- **Relacion:** ACT-014, ACT-015.
- **Dependencias:** EXE-015.
- **Tareas:**
  - Hacer idempotente el resultado de batalla.
  - Preferir resultado automatico de batalla.
  - Mantener registro manual como correccion autorizada.
  - Rechazar ganador incompatible con el enfrentamiento.
- **Salida:** un ganador no puede avanzar dos veces.
- **Implementado:** `advanceWinner`: rechaza registro si `match.winnerId` ya existe (idempotencia). Tercer puesto: mismo chequeo de idempotencia + validación de participante compatible. `recordBattleResult`: busca en todas las fases (no solo la actual) y solo avanza si el match no tiene ganador previo. Lint, test (45 battleRoom, 3 tournamentRoom), build pasan.

### EXE-018 - Generar cartelera descargable de torneo ⛔ BLOQUEADO

- **Relacion:** ACT-016.
- **Dependencias:** EXE-016.
- **Tareas:**
  - Crear renderer de bracket.
  - Integrar logo aprobado.
  - Añadir previsualizacion.
  - Descargar PNG.
  - Probar brackets de 4, 8 y 16 participantes.
- **Salida:** cada torneo puede generar su cartelera.
- **Estado real:** `BattlePosterDialog` solo genera carteleras de batalla. No existe renderer del bracket ni pruebas para 4, 8 y 16 participantes. Bloqueada por la seleccion del renderer y la aprobacion de logo/assets.

### EXE-022 - Emparejamiento manual editable en setup de torneo ✅

- **Relacion:** ACT-014.
- **Dependencias:** EXE-015.
- **Archivos iniciales:** `apps/server/src/rooms/tournamentRoom.ts`, `apps/server/src/index.ts`, `apps/web/src/app/tournament/page.tsx`.
- **Tareas:**
  - Permitir reordenar participantes durante `setup`.
  - Validar admin, estado y consistencia del orden en servidor.
  - Bloquear el orden al iniciar el torneo.
  - Mostrar vista previa de enfrentamientos.
  - Añadir pruebas de reorden y bloqueo.
- **Salida:** el bracket manual se puede revisar y editar antes de bloquearse.
- **Implementado:** `reorderParticipants(tournamentId, adminToken, orderedIds)` en `TournamentRoomManager`: valida token admin, `status === "setup"` y que `orderedIds` contenga exactamente los mismos participantes (sin faltantes, duplicados ni desconocidos). Endpoint `POST /api/tournaments/:id/participants/order`. UI en setup (modo manual): lista con botones ↑/↓ por participante, guardado optimista con rollback ante error, y sección "Enfrentamientos" con la vista previa de los cruces (1 vs 2, 3 vs 4...). El bracket generado al iniciar respeta el orden editado; el servidor rechaza reordenamientos una vez iniciado. Pruebas añadidas (4 tests: reorden válido reflejado en el bracket, token inválido, torneo ya iniciado, ids faltantes/duplicados/desconocidos). Total: 7 tests en tournamentRoom. Se corrigió además la higiene de `battlePersistence.test.ts` (limpieza `beforeAll`/`afterAll` de ids fijos) que hacía fallar corridas repetidas del suite por constraint único en la BD local. Lint, typecheck, test (140 tests), build pasan.

## Fase 6 - Pulido, navegacion y demos

**Objetivo:** cerrar experiencia publica despues de estabilizar la logica.

### EXE-019 - Limpiar navegacion publica ✅

- **Relacion:** ACT-005.
- **Dependencias:** EXE-007, EXE-015.
- **Tareas:**
  - Ocultar catalogo y demos en produccion.
  - Revisar enlaces de Inicio, Jugar y Torneos.
  - Revisar responsive.
  - Revisar accesibilidad de foco y teclado.
- **Salida:** navegacion publica coherente.
- **Implementado:** Nav principal reducida a 3 enlaces públicos: Inicio, Jugar, Torneos. Catálogo y Demo 1vs1 removidos de la navegación principal (las rutas siguen accesibles para desarrollo). Torneos ahora visible en móvil (sin `hidden`). Lint, build pasan.

### EXE-020 - Aplicar mejoras visuales 🟡 PARCIAL

- **Relacion:** ACT-006, ACT-007, ACT-008.
- **Dependencias:** Fases 2 a 5.
- **Tareas:**
  - Cambiar logo de carteleras.
  - Mejorar espaciado de Arma la batalla.
  - Revisar botones, estados y jerarquia.
  - Validar movil y escritorio.
- **Salida:** pulido visual sin alterar reglas ni permisos.
- **Estado real:** La UI conserva una identidad oscura/roja coherente y estructura responsive. Siguen pendientes el logo aprobado de carteleras, el espaciado especifico de "Arma la batalla" y la validacion manual completa en movil y escritorio.

### EXE-021 - Crear demos guiadas y reales 🟡 PARCIAL

- **Relacion:** ACT-020.
- **Dependencias:** EXE-012, EXE-013, EXE-014.
- **Tareas:**
  - Mantener demo visual sin persistencia real.
  - Crear salas demo temporales.
  - Añadir bots o participantes simulados.
  - Marcar y limpiar salas demo.
  - Documentar rutas y comandos.
- **Salida:** existen demos seguras para presentacion y validacion tecnica.
- **Estado real:** Demo visual existente en `/demo/1vs1` y rutas documentadas. Faltan salas demo temporales, bots o participantes simulados, marcado y limpieza de salas para cumplir la salida definida.

## Fase 7 - Endurecimiento de membresias y administracion

**Objetivo:** centralizar la identidad visible, asignar roles dentro del lobby y evitar que las credenciales del creador se reutilicen para obtener administracion.

### EXE-023 - Unificar miembros, invitaciones y administracion ✅

- **Relacion:** ACT-002, ACT-003, ACT-009.
- **Dependencias:** EXE-005, EXE-006, EXE-010.
- **Tareas:**
  - Hacer que nuevos usuarios entren en espera con una identidad estable.
  - Usar una invitacion reutilizable por sala y revocar el enlace anterior al regenerarla.
  - Asignar y revocar roles operativos exclusivamente desde el lobby.
  - Implementar coadmin, transferencia y revocacion administrativa en servidor.
  - Conservar la combinacion host+juez y transferir el control de host atomicamente.
  - Persistir los IDs administrativos junto al estado principal.
- **Salida:** el creador reclama una sola vez la administracion y los permisos posteriores dependen de la membresia autorizada por servidor.
- **Implementado:** `RoomMember` y `Battle.members` exponen alias, roles y conexion; el flujo de inicio e invitacion guarda alias/token fuera de la URL; Socket.IO incorpora eventos de invitacion, asignacion/revocacion de roles y gestion de admins. El enlace es unico y reutilizable, y su regeneracion revoca el anterior. La transferencia de host acepta miembros en espera, conserva host+juez y elimina el control del host previo. Las pruebas de `BattleRoomManager` usan persistencia aislada y cubren espera, coadmin, transferencia, revocacion y host acumulable. Lint, typecheck, test (139 tests) y build pasan.

### EXE-024 - Implementar voto de sala para Rey de la pista ✅

- **Relacion:** ACT-015, ACT-017.
- **Dependencias:** EXE-013, EXE-016, EXE-023.
- **Tareas:**
  - Añadir `room_vote` al contrato de votacion.
  - Activarlo automaticamente en las batallas de Rey de la pista.
  - Bloquear el padron al comenzar la fase de votacion.
  - Incluir solo miembros conectados con rol y excluir a los MC activos.
  - Excluir miembros en espera e ingresos posteriores al cierre del padron.
  - Dejar de esperar a votantes que se desconecten.
  - Resolver por mayoria simple y conservar la regla normal de replica ante empate.
- **Salida:** la comunidad presente en la sala decide cada duelo de Rey de la pista sin permitir votos de los competidores.
- **Implementado:** `RoomVote`, evento `room:vote`, padron por batalla/ronda y calculo de mayoria en servidor. El inicio requiere al menos un votante elegible y ya no exige mesa de jueces para este metodo. La UI muestra la eleccion a cada miembro autorizado y confirma el voto sin revelar resultados parciales. Pruebas cubren mayoria, empate sin resolucion arbitraria, permisos, padron cerrado, desconexion y activacion desde torneo. Lint, typecheck, test (147 tests) y build pasan.

## Orden recomendado de ejecucion

1. EXE-001, EXE-002 y EXE-003.
2. EXE-004, EXE-005 y EXE-006.
3. EXE-007, EXE-008 y EXE-009.
4. EXE-010 y EXE-011.
5. EXE-012, EXE-013 y EXE-014.
6. EXE-015, EXE-016, EXE-017, EXE-018 y EXE-022.
7. EXE-019, EXE-020 y EXE-021.
8. EXE-023.
9. EXE-024.

## Primer bloque ejecutable

El primer bloque concreto debe ser:

1. EXE-001: matriz de permisos. ✅ COMPLETADO
2. EXE-002: identidad y sesiones. ✅ COMPLETADO
3. EXE-003: configuracion canonica. ✅ COMPLETADO

No comenzar el lobby avanzado de torneos hasta cerrar estos tres contratos. Las decisiones de permisos, identidad y formato afectan simultaneamente al servidor, al cliente, a las pruebas y a la persistencia.

## Estado actual

EXE-023 y EXE-024 completadas. EXE-016 completada con eliminacion directa, tercer puesto, rey de la pista con voto de sala y doble eliminacion para 4, 8 y 16 participantes. La siguiente prioridad funcional es continuar EXE-021 (demo real aislada). EXE-018 y parte de EXE-020 permanecen bloqueadas por decisiones y assets de diseño.

Actualización de recuperación: EXE-004 y EXE-005 incluyen ahora carga de batallas activas pausadas al arrancar, sesiones de 256 bits almacenadas como huellas, votos y padrón por ronda y réplica, plazos persistidos y reanudación explícita desde la web. El inicio amplía las sesiones a 24 horas en la misma transacción. Los datos históricos incompletos requieren revisión y no conceden acceso nuevo. Las seis migraciones se aplicaron a la base local tras respaldar, restaurar y ensayar la actualización en una copia. Las cifras y descripciones de las primeras implementaciones anteriores son históricas; el contrato vigente está en `docs/RECUPERACION_BATALLAS.md`. La recuperación de torneos y la coordinación de varias instancias siguen pendientes.
