# Recuperación de batallas: estado y contrato

## Estado verificado

El servidor carga los **lobbies y las batallas activas** guardados antes de aceptar conexiones. Las batallas activas se recuperan pausadas y sus miembros deben reconectarse con sus propias sesiones. Las sesiones se guardan como huellas de tokens, se actualizan al cambiar roles y se revocan al salir. Los permisos recuperados deben coincidir con los miembros y roles guardados en la sala. Los cambios de rol se confirman antes de anunciarse y, si falla la persistencia, la sala se bloquea hasta reiniciar el servidor.

Se han añadido la entrada pendiente de votación y el orden de participantes al estado persistido, y se guarda el estado después de cada transición de fase. Las sesiones nuevas usan tokens aleatorios de 256 bits, que no se registran en los logs. La API de creación de batallas espera a que PostgreSQL confirme la creación y devuelve un error si falla; las salas creadas dentro de torneos aún no tienen esa garantía.

El repositorio serializa por sala las escrituras dentro de una misma instancia del servidor y actualiza en una transacción los roles de todas las sesiones y la administración de la sala. Los tokens de lobby caducan tras cinco minutos sin actividad y se renuevan mientras hay conexión; durante una batalla activa la ventana de desconexión es de 24 horas. Al recuperar un lobby, los enlaces de invitación anteriores dejan de ser válidos y un administrador reconectado puede crear uno nuevo. Si el creador nunca llegó a entrar en la sala antes del reinicio, aún no hay una sesión persistida con la que recuperar esa administración.

Los votos de rúbrica y patrón y los resultados nuevos se separan por número de réplica, tanto en memoria como en la base. Los datos históricos anteriores a la migración se conservan con réplica `0`: no es posible reconstruir automáticamente qué datos históricos pertenecían a una réplica cuando se sobrescribieron anteriormente.

La migración se aplicó y la separación de votos se comprobó en una base aislada. En otra base de pruebas se introdujeron dos votos históricos duplicados: la migración se detuvo, conservó ambos registros y no creó las columnas nuevas. PostgreSQL confirmó que la causa eran los duplicados; Prisma mostró un error genérico de transacción. En Windows, la regeneración del cliente habitual informó un bloqueo de la DLL por un proceso Node activo. Tras detener el servidor de desarrollo, se generó correctamente el cliente habitual. El procedimiento para futuros bloqueos está en `ENTORNO_LOCAL.md`.

Al resolver una ronda, el estado de la batalla, el resultado y los marcadores de sus participantes se escriben juntos en una transacción. La prueba de PostgreSQL comprueba que un fallo en el resultado revierte también el estado y los marcadores. El inicio, las transiciones de fase, el cierre de entrada y los votos de rúbrica, patrón, libre y de sala esperan la confirmación antes de notificarse; ante un fallo de escritura, la sala queda bloqueada y se desconecta a sus clientes. Cada voto de entrada de patrón y el estado resultante se guardan en una transacción. El padrón de sala se guarda junto con el inicio de su fase de votación y permanece separado por ronda y réplica. Los temporizadores y las desconexiones esperan en la misma cola de eventos de la sala. Se verificó con el servidor real que, al detener PostgreSQL durante el inicio o un avance, no se anuncian el inicio ni la nueva fase, respectivamente; también se comprobó el guardado del padrón y los votos de sala. La cola no coordina varias instancias.

El gestor reconstruye las batallas activas con sus miembros, sesiones, votos de la ronda y réplica actuales, padrón y entrada pendiente. Las recupera pausadas, rechaza avances y votos y no arranca temporizadores. El administrador u host puede reanudar desde la web cuando hayan vuelto los MC, los jueces y, durante el voto de sala, todos los miembros del padrón. Puede conservar el plazo guardado o reiniciar el reloj de esa fase sin borrar votos. Un plazo vencido o desconocido requiere elegir reiniciar el reloj. La reanudación se guarda antes de anunciarse, cambia el identificador de fase y reactiva los temporizadores; si todos los votos ya estaban guardados, resuelve la ronda una sola vez. Las partidas con credenciales, participantes, votos o padrón histórico incompletos se mantienen pausadas con una explicación y no reciben privilegios nuevos.

Cada transición nueva guarda su identificador y, si la fase tiene reloj, su fecha límite junto con el estado. Incluye el inicio, las pausas y las transiciones de entrada de patrón. Los temporizadores usan el tiempo restante hasta esa fecha, descontando la espera del guardado, y verifican la identidad de la fase antes de ejecutarse. La reconstrucción permite consultar si el plazo está pendiente, vencido, no existe por tratarse de una fase sin reloj o es desconocido para datos antiguos. Un plazo vencido no hace avanzar una batalla reconstruida.

La migración `20261122000500_persist_phase_deadlines` se verificó en la base aislada y el cliente Prisma se regeneró correctamente. Las filas antiguas conservan un plazo nulo; no se inventan tiempos a partir del valor histórico de `timeRemaining`.

Las seis migraciones de recuperación también se aplicaron a la base local `freestyle` en el puerto 5433, después de crear un respaldo en `.local-backups`, restaurarlo en una base nueva y ensayar allí las migraciones. Se comprobó que no había duplicados históricos de votos de entrada. Los votos de sala y libres anteriores a estas migraciones que solo existían en memoria no pueden recuperarse. Las bases de otros entornos requieren su propio respaldo y migración.

## Verificación ejecutada

La suite completa del servidor pasó con 224 pruebas. Se comprobaron reinicios de proceso reales con sesiones y votaciones incompletas de rúbrica, patrón, voto libre y voto de sala; también una cuenta atrás vencida que permanece pausada hasta que el organizador reinicia su reloj. El comprobador reproducible está en `scripts/verify-battle-recovery.cjs`: exige una base descartable llamada `freestyle_test`, crea sus propias salas y las elimina al terminar. También pasaron las comprobaciones de tipos, lint web y compilaciones de servidor y web. La revisión independiente detectó y permitió corregir la identidad de reconexión al abrir otra pestaña y la reconexión tardía de miembros después de reanudar.

```powershell
# Configurar DATABASE_URL hacia la base descartable antes de ejecutar.
node scripts/verify-battle-recovery.cjs
```

La recuperación de torneos, la coordinación de varias instancias y la reparación de historiales incompletos quedan fuera de esta implementación. No debe iniciarse otra instancia con las mismas salas activas.

## Revisión previa a la migración de votos

La migración `20261122000300_scope_votes_by_replica` comprueba si hay votos de patrón duplicados para la misma sala, ronda, juez, MC y entrada. Si encuentra duplicados, se detiene sin eliminarlos. Antes de aplicarla a una base existente, hacer un respaldo y revisar los posibles conflictos con una consulta de solo lectura:

```sql
SELECT room_id, round, mc_id, entry_index, judge_id, count(*) AS total
FROM live_battle_patron_entry_votes
GROUP BY room_id, round, mc_id, entry_index, judge_id
HAVING count(*) > 1;
```

La decisión sobre qué voto conservar requiere revisar esos datos; no ejecutar una limpieza automática. Si la migración falla, seguir el procedimiento de resolución de migraciones de Prisma después de respaldar y revisar la base.

## Contrato de recuperación a implementar

1. **Identidad y acceso.** Una sesión de reconexión debe estar asociada a una sala y a una identidad con sus roles. Persistir una huella de un token aleatorio con suficiente entropía, caducidad y revocación; el token en claro solo lo conserva el cliente. Las credenciales de administración e invitación requieren las mismas propiedades y no deben recuperarse a partir del identificador de usuario. Las salas antiguas sin credenciales recuperables no pueden conceder administración automáticamente.
2. **Miembros.** Guardar identidades y roles, incluidos miembros en espera, administradores y host. Tras un reinicio aparecen desconectados hasta que acrediten su sesión. La pérdida de la conexión no debe borrar competidores, jueces o resultados de una batalla en curso.
3. **Estado de partida.** Conservar configuración, orden de participantes, ronda, réplica, fase, turno, palabra, entradas pendientes, marcadores y resultados. Identificar las rondas también por número de réplica para impedir que datos de una réplica sobrescriban los de otra.
4. **Votos.** Persistir rúbrica, patrón, voto libre y voto de sala con claves únicas que incluyan sala, réplica, ronda, votante y, en su caso, participante y entrada. Guardar también el padrón cerrado de voto de sala. La repetición de un mensaje debe actualizar o rechazar el mismo voto de acuerdo con la regla existente, sin duplicar puntuaciones.
5. **Temporizadores.** Guardar la fecha límite de la fase y su identificador de transición. Al reiniciar, detener la progresión hasta recuperar el control del organizador; al reanudar, informar del tiempo restante y requerir una decisión explícita para fases que vencieron durante la caída. Ningún temporizador antiguo puede avanzar una fase nueva.
6. **Consistencia.** Serializar o controlar por versión los cambios de cada batalla. Confirmar en una transacción el estado y los votos o resultados asociados antes de comunicar éxito. Si PostgreSQL falla, rechazar el cambio con un mensaje visible y mantener un estado coherente; no avanzar en silencio.
7. **Arranque.** Aplicar migraciones antes de arrancar. Cargar el estado y las credenciales de salas activas antes de aceptar conexiones; fallar de forma clara si no se puede acceder a la base. La recuperación de una sala no debe exponer secretos en la respuesta pública.

## Pruebas necesarias para considerar completada la función

- Crear una sala, reiniciar el proceso y recuperar a un administrador, un MC y un juez usando sus propias sesiones; rechazar tokens inválidos, revocados o de otra sala.
- Repetir el reinicio en lobby, durante un turno, durante una entrada pendiente y con votaciones incompletas de cada modalidad.
- Verificar orden, palabra, fase, tiempos, votos y resultados antes y después del reinicio; incluir una réplica y un mensaje repetido.
- Simular fallo de base de datos y escrituras concurrentes; comprobar que no se anuncia como guardada una operación fallida ni se vuelve a un estado anterior.
- Comprobar migración de salas antiguas sin asumir que pueden recuperar privilegios, y probar el flujo desde la interfaz web.
