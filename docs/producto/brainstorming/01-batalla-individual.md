# 1. Batalla individual

## Configuración guiada — decisión del 28 de noviembre de 2026

**Confirmado; pendiente de diseño completo e implementación.** Quien crea la batalla (administrador u organizador) configura mediante pasos con «Siguiente» y opciones preseleccionadas. Al terminar llega al lobby, donde puede volver a cambiar la configuración antes de iniciar. Este recorrido sustituye, para el nuevo diseño, la recomendación histórica de configurar solamente después de crear la sala.

El alcance solicitado incluye las reglas de batalla de 1vs1 y torneo. El usuario pide una interfaz ordenada, menos técnica y con más explicaciones. Quedan por definir los pasos, las opciones disponibles y sus preselecciones concretas, salvo voto secreto y publicación automática del ganador, ya confirmados en la especificación. La elección del método de cada juez se mantiene aparte.

**Configuración por ronda, confirmada:** el organizador elige la cantidad de rondas y configura de forma independiente el formato y la cantidad de entradas de cada una. No imponer un único formato o número de entradas a todas las rondas. Se confirma que «formato» abarca tanto intercambio como contenido, separados en el configurador. Las opciones y restricciones se detallan a continuación; las preselecciones concretas siguen abiertas. El contrato y las tablas de puntuación deberán contemplar las diferencias entre rondas cuando se prepare la implementación.

El recorrido de creación del torneo conserva la inscripción guiada y la confirmación de titulares ya acordadas; este cambio no autoriza saltarlas. Compartir las piezas de configuración conforme al catálogo UI.

### Intercambio, patrones y contenido — ampliación del 28/11

**Confirmado por el usuario, sin implementación todavía.** Cada ronda tiene tres elecciones diferenciadas. El orden definitivo aprobado es Contenido → Intercambio → Cantidad de patrones, dentro de cada ronda. Sustituye la indicación anterior de elegir primero la cantidad de patrones.

| Elección | Opciones y reglas confirmadas |
|---|---|
| Contenido | Libre, Con concepto/temática, Random Mode, Hard Mode y Deluxe. Con imagen queda para el futuro. |
| Intercambio | 4x4, 8x8, 12x12 (30 segundos por intervención, alternando A → B → A → B…) y 16x16 (1 minuto por intervención). Se confirma que 16x16 recorre A → B → B → A, con un minuto en cada intervención: cuatro minutos de rap en total (dos por MC), sin contar pausas. En 12x12 no se impone la inversión B → A de la vuelta del 16x16; se mantiene la alternancia entre MC. |
| Cantidad de patrones | 1, 2, 3, 4 o 5, con restricciones según intercambio. En 4x4, solo 3, 4 o 5; en 16x16, obligatoriamente 1 y con ida y vuelta en orden A → B → B → A. No asumir que ese «1» elimina la vuelta. |

**Cómo se cuenta, confirmado:** en 4x4, 8x8 y 12x12, N patrones significa N intervenciones de cada MC, alternadas. Tres patrones producen A → B → A → B → A → B: tres intervenciones por MC y seis en total. Se conserva la excepción del 16x16: selector fijo en 1 con cuatro intervenciones A → B → B → A. Se confirma mostrar los formatos incompatibles con la cantidad seleccionada: visibles, deshabilitados y con una explicación del requisito. Ejemplos: «4x4 requiere al menos 3 patrones» y «16x16 requiere 1 patrón e incluye ida y vuelta». No sustituir esta regla por ocultarlos ni cambiar automáticamente la cantidad para habilitarlos.

Contenido definido por el usuario:

- **Libre:** solo rapean.
- **Con concepto/temática:** un concepto en cada patrón.
- **Random Mode:** una palabra cada 10 segundos. Disponible en 4x4, 8x8, 12x12 y 16x16; el usuario corrige la restricción inicial a los dos intercambios largos.
- **Hard Mode:** palabras cada 5 segundos. Disponible en 4x4, 8x8, 12x12 y 16x16, conforme a la misma corrección.
- **Deluxe:** 4x4; las primeras dos intervenciones de cada MC son a capella y todas las restantes continúan en 4x4 libre con base, según la confirmación del usuario. Son dos intervenciones a capella por MC, no dos entre ambos. Se mantiene la restricción de al menos tres intervenciones por MC para 4x4 y el límite configurado de hasta cinco.
- **Con imagen:** funcionalidad futura; no habilitarla como si estuviera disponible.

**Orden aprobado:** elegir la cantidad de rondas y, dentro de cada ronda, Contenido → Intercambio → Cantidad de patrones. El contenido permite explicar las restricciones (por ejemplo, Deluxe requiere 4x4) y el intercambio determina las cantidades válidas (16x16 requiere 1 e incluye ida y vuelta). Mantener opciones incompatibles visibles, deshabilitadas y explicadas. El diseño completo y su implementación siguen pendientes.

**FMS siempre por patrón, confirmado:** la votación clásica FMS puntúa cada patrón con su propia casilla, también dentro de las intervenciones largas. En 16x16, cada minuto se divide en 6 casillas, cantidad confirmada por el usuario; no recibe una única nota global por minuto. Distinguir la cantidad configurada para organizar intervenciones de la cantidad de patrones puntuables que contienen. Se mantienen escala 0–4 en pasos de 0,5 y Escena/Flow por MC para toda la ronda. En el recorrido completo A → B → B → A son 12 casillas por MC (dos minutos de seis casillas) y 24 entre ambos, aparte de Escena y Flow. Por la suma ya aprobada, el máximo de esta ronda es 56 puntos por MC: 12 × 4 + 4 + 4. Se confirma 12x12 con 3 casillas por intervención de 30 segundos: con N intervenciones por MC, son 3 × N casillas por MC y ronda. Escena y Flow se mantienen una vez por MC para toda la ronda. Se confirma 8x8 con 2 casillas por intervención: con N intervenciones, cada MC tiene 2 × N casillas en la ronda, más Escena y Flow una vez. Se confirma 4x4 con 1 casilla por intervención: N intervenciones producen N casillas por MC y ronda.

| Intercambio | Casillas FMS por intervención | Casillas por MC en toda la ronda |
|---|---|---|
| 4x4 | 1 | N |
| 8x8 | 2 | 2 × N |
| 12x12 | 3 por cada turno de 30 segundos | 3 × N |
| 16x16 | 6 por cada minuto | 12, con las dos intervenciones obligatorias por MC |

N corresponde a las intervenciones configuradas por MC en 4x4, 8x8 y 12x12. El 16x16 mantiene su excepción ya acordada. A las casillas se suman Escena y Flow una vez por MC para toda la ronda.

**Pendiente de precisar, una cuestión a la vez:** combinaciones restantes de contenido/intercambio y mecanismo de avance de conceptos y palabras; tratamiento de un formato ya seleccionado que se vuelve incompatible al cambiar la cantidad de patrones. No deducir respuestas por el nombre del formato. Las nuevas definiciones deberán incorporarse a contratos por ronda, reloj, conceptos y puntuación antes de implementar el rediseño.

## Decisiones del 23 de noviembre de 2026

Estado: cambios de producto confirmados, pendientes de especificación final e implementación. Esta sección prevalece sobre las recomendaciones anteriores de este documento.

### Acceso desde Inicio

1. Pulsar **Crear batalla**.
2. Elegir qué crear: **1vs1**, **torneo** o **Rey de la pista**.
3. Si se elige 1vs1, pedir el **nickname (nombre de MC)**.
4. Conservar el resto del recorrido actual: crear la sala, mostrar su código y confirmación, entrar al lobby, configurar, asignar roles e iniciar.

La selección del tipo de experiencia ocurre antes de pedir el nickname del 1vs1. Los detalles de los recorridos de torneo y Rey de la pista se definirán por separado. La propuesta anterior de entrar automáticamente al lobby no ha sido aprobada.

### Roles y modalidad de exhibición

| Rol o función | Regla acordada |
|---|---|
| MC | Dos participantes para el 1vs1 |
| Administración | Se conserva la administración de quien crea la sala |
| Juez | Necesario para la batalla juzgada; no se exige en exhibición |
| Host | Opcional |
| Público | Opcional |

Se podrá seleccionar **Exhibición**, una modalidad que no necesita juez ni puntaje de jueces. Los 1vs1 donde solo participan dos personas quedan como exhibición: pueden practicar, usar conceptos o batallar entre amigos sin que la ausencia de juez bloquee el inicio. La modalidad no cambia el formato de turnos, tiempos o conceptos por sí sola. El administrador puede ser también uno de los MC, como permite el modelo de roles actual; no se ha acordado asignarle ese puesto automáticamente.

**Confirmado:** nombre «Exhibición», selección de esa modalidad y ausencia de juez obligatorio y puntaje de jueces; los 1vs1 de solo dos personas son exhibiciones. El usuario confirmó que la exhibición termina **sin ganador oficial**. Conserva los turnos, tiempos y conceptos elegidos, sin una votación para decidir un vencedor.

El selector **«Batalla con jueces / Exhibición» estará dentro del lobby, junto al formato**. Si solo están los dos MC, quedará seleccionada Exhibición. Ubicación y selección confirmadas por el usuario el 23 de noviembre de 2026.

Si después se incorporan público, host o jueces, **se mantiene la modalidad elegida**. Solo el administrador puede cambiarla explícitamente antes de iniciar; la entrada de otra persona no transforma una exhibición en batalla juzgada. Regla confirmada por el usuario el 23 de noviembre de 2026.

La interfaz final de exhibición deberá comunicar que terminó sin presentar ganador, puntuación de jueces ni empate competitivo. El diseño visual de esa pantalla se concretará en la especificación.

Las recomendaciones que siguen documentan una revisión anterior; no son cambios aprobados por el usuario.

## Flujo observado

Inicio → Crear sala → escribir alias → crear con configuración predeterminada → ver/copiar código → entrar como admin → configurar formato y asignar roles en el lobby → iniciar → turnos y votación → resultado.

El acceso también puede hacerse con código desde Inicio o con una invitación que solicita el alias. El lobby explica que las personas quedan en espera hasta recibir un rol. Ya existen cartel previo y cartel de resultado, selección de primer turno, gestión de personas y roles, designación de host y edición del formato. Conviene aprovechar estas piezas.

## Hallazgos y mejoras propuestas

| Observado en el código | Implicación para la experiencia | Propuesta |
|---|---|---|
| La creación inicial pide «Tu alias de MC», aunque quien crea entra como admin. | El organizador puede creer que ocupa automáticamente un puesto de MC. | Usar «Tu AKA o nombre visible» y explicar que el rol se asigna dentro de la sala. |
| La sala se crea con valores predeterminados; el formato se edita después. | La persona comparte una sala antes de revisar sus reglas. | Mostrar un resumen de reglas antes de crear, con «Cambiar formato» opcional. Mantener la creación rápida. |
| Hay una pantalla intermedia de «Sala creada» antes del lobby. | Añade un paso para quien quiere organizar inmediatamente. | Entrar directo al lobby y mostrar allí código, enlace y confirmación de creación. |
| El código se copia en la pantalla de creación; el enlace reutilizable se genera dentro del lobby. | Las dos formas de invitar aparecen en momentos distintos. | Un bloque «Invitar» con copiar enlace, copiar código y, posteriormente, QR. Mantener la autorización vigente. |
| El lobby indica cuántos MC y jueces faltan, pero usa la misma comprobación de jueces para todos los sistemas. | La preparación puede contradecir las reglas de un modo, especialmente voto de sala. | Una lista de requisitos que cambie según la votación y el avance elegidos. |
| Con 2 o 4 jueces el mensaje reduce la situación a «falta 1 juez». | No explica que también se puede reducir la mesa a 1 o 3. | «Necesitas 1, 3 o 5 jueces; ahora hay 2. Agrega uno o quita uno». |
| Las personas pueden tener varios roles, mientras el selector dice «Cambiar a…». | No queda claro si se agrega, reemplaza o conserva un rol. | Distinguir «Rol en esta batalla» de «Permisos de organización» y explicar las combinaciones permitidas. |
| Réplica automática se resume como «Una ronda si el resultado termina empatado», mientras el contrato admite reglas propias, umbral y límite. | El resumen no comunica todas las reglas que pueden regir el desempate. | Mostrar «Hasta N réplicas · diferencia de X puntos · formato Y», según la configuración real. |
| El cierre permite crear una nueva batalla y compartir cartel. | Repetir un encuentro requiere volver al inicio. | Ofrecer «Revancha» y «Repetir formato» con una sala nueva y confirmación de quienes participarán. |

## Dos formas de simplificar la creación

**Recomendada: creación rápida con resumen editable.** AKA precargado si hay perfil, reglas legibles, enlace y código al llegar al lobby. Ocultar los ajustes detallados hasta que se soliciten. Evita añadir un asistente largo a una actividad pequeña.

**Alternativa: asistente de varios pasos.** Identidad → formato → personas → revisión. Enseña más a quien organiza por primera vez, pero añade pasos en cada batalla. Podría reservarse para una ayuda inicial opcional.

## Recorrido propuesto en la revisión anterior

1. Elegir «Batalla individual».
2. Ver identidad y reglas predeterminadas. Poder cambiarlas antes de crear.
3. Crear y llegar al lobby con confirmación, código y enlace disponibles.
4. Ver los dos puestos de MC, la votación elegida y quién controla los turnos.
5. Asignar los roles; cada persona ve «En espera», «MC», «Juez», «Host» o «Público» y una explicación breve de su siguiente acción.
6. Iniciar cuando se cumplan los requisitos de ese formato.
7. Mostrar durante la batalla quién participa ahora, qué viene después y qué acción corresponde a cada rol.
8. Cerrar con ganador o empate, desglose comprensible y las acciones compartir/revancha. Cuando existan perfiles y XP, añadir el aporte de esta batalla al progreso.

## Ajustes de formato que merecen atención

- El selector muestra 1 y 2 minutos, pero la validación también contempla 30, 45 y 90 segundos. Alinear las opciones visibles con las que se decida ofrecer.
- Las opciones de entradas visibles son compartidas; los rangos del contrato cambian entre formatos. Mostrar opciones válidas para el formato seleccionado.
- Al personalizar entradas o avance, indicar «Formato personalizado» si la configuración deja de corresponder al preset visible.
- Explicar con un ejemplo la relación entre «ronda», «turno», «entrada» e «ida y vuelta». Validar el lenguaje con usuarios de la comunidad.
- Ofrecer presets con nombres por validar: «Rápida», «Con conceptos» y «Por entradas». Cada tarjeta debe decir duración, votación y control, sin obligar a entender los campos internos.

## Cómo evaluar la propuesta

En una prueba con alguien que no conozca la aplicación, observar si puede crear, compartir y completar el cartel sin ayuda. Registrar tiempo hasta compartir invitación, tiempo hasta empezar y motivos que bloquean el inicio. No fijar una meta de segundos sin medir primero el flujo actual.

Casos para validar más adelante: creador que solo organiza; creador que también juzga; mesa de 2 jueces; invitado esperando rol; reconexión; configuración manual sin controlador; revancha sin duplicar historial.

## Fuentes locales

- `apps/web/src/app/page.tsx`: creación, código y acceso.
- `apps/web/src/app/unirse_batalla/[id]/page.tsx`: entrada por invitación.
- `apps/web/src/components/BattleLobby.tsx`: preparación y asignación de roles.
- `apps/web/src/components/BattleModeSelector.tsx`: opciones visibles.
- `apps/web/src/app/battle/[id]/page.tsx`: experiencia en vivo y cierre.
- `packages/shared/src/battleConfig.ts`: formatos, compatibilidad y réplicas.
- `apps/server/src/rooms/battleRoom.ts`, método `startBattle`: requisitos efectivos del inicio.
