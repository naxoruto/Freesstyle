# 3. Rey de la pista

## Flujo observado en la revisión inicial del código

Entrar a Torneos → elegir «Rey de la pista» → escribir participantes → ordenar o sortear la fila → iniciar → duelo de los dos primeros → ganador permanece contra el siguiente → repetir hasta agotar retadores → último ganador es campeón.

Ya existe una previsualización del duelo inicial y la fila en la configuración manual. El servidor fuerza voto de sala para este modo: miembros conectados con rol, excepto los MC activos, eligen ganador según el padrón de votación. El modo no es todavía una fila abierta permanente: funciona con una lista cerrada de participantes.

Esto describe la implementación revisada, no la experiencia acordada: **el usuario aclaró que Rey de la pista es una sesión abierta, con entradas y salidas, y puede durar indefinidamente**. La propuesta de lista cerrada queda sustituida por el diseño siguiente.

## Hallazgos y mejoras propuestas

### Regla aclarada por el usuario

**Votan los concursantes inscritos en Rey de la pista.** Para cada duelo, se excluye a los dos MC que están batallando. El público externo no vota; host o admin solo votan si también son concursantes elegibles. Cada concursante elegible tiene un voto de igual peso.

Ejemplo con A, B, C, D y E: en A vs B votan C, D y E. Si gana A y sigue A vs C, votan B, D y E, siempre que permanezcan en la sesión. **Confirmado por el usuario: quienes ya perdieron siguen votando mientras sigan en la sesión.** Perder un duelo no expulsa a la persona de la sesión.

La implementación actual usa un padrón de miembros de la sala y excluye a los MC activos, pero no comprueba que cada votante esté inscrito como concursante del evento. Por lo tanto, el voto de sala existente no garantiza todavía la regla aclarada. La futura implementación deberá vincular el padrón con la inscripción al evento y conservar esa pertenencia entre duelos, sin exigir asignar el rol de juez.

| Observado en el código | Implicación para la experiencia | Propuesta |
|---|---|---|
| Es una opción dentro de Torneos y comparte el título «Formato eliminatorio». | No comunica de inmediato su dinámica propia. | Entrada «Rey de pista», con explicación de una frase y ejemplo de fila. Compartir infraestructura donde corresponda. |
| Hereda la exigencia de al menos 4 personas y potencias de 2. | Impide organizar una fila de 3, 5 o 6 aunque la dinámica no necesita un cuadro. | Admitir al menos 3 participantes y cantidades no restringidas a potencias de 2; fijar el máximo después de validar capacidad. |
| El servidor fuerza voto de sala, pero el lobby requiere 1, 3 o 5 jueces para habilitar inicio. | Una sala con concursantes habilitados para votar podría quedar bloqueada por la interfaz. | Preparar dos MC y concursantes votantes conectados; no exigir jurado externo. Reproducir antes de corregir. |
| El resumen del lobby trata cualquier votación distinta de patrón como rúbrica; el selector tampoco representa voto de sala. | Puede mostrar reglas distintas de las efectivas. | Mostrar «Voto de concursantes» y quién puede votar. Evitar que cambiar otros ajustes sustituya inadvertidamente esa regla. |
| La vista activa enumera duelos dentro de una fase. | La persona debe deducir quién ocupa la pista y quién viene. | Destacar ocupante actual, retador, siguiente persona y fila restante. Mantener el historial debajo. |
| Cada duelo crea una sala nueva. | Puede exigir repetir acceso y asignación de roles, rompiendo la sensación de continuidad. | Conservar el contexto del evento y llevar a cada persona al siguiente duelo según corresponda. |
| El campeón es quien gana el último duelo de una lista cerrada. | No representa una sesión abierta que puede durar indefinidamente. | Mostrar al rey actual y la mejor racha; definir campeón solo si el modo con límite tiene una condición que lo determine. |

## Dos formas de jugar — confirmadas como dirección de producto

La elección de rival tendrá dos opciones: **«El vencedor elige»** y **«Fila determinada»**. Ambas comparten una sesión abierta, votación entre concursantes ajenos al duelo actual y permanencia del ganador en pista. Se combinan con dos duraciones: **«Con límite»** e **«Infinito»**.

| Aspecto | El vencedor elige | Fila determinada |
|---|---|---|
| Próximo rival | El ganador selecciona entre retadores habilitados. | Sale de una fila visible que conserva el orden de espera. |
| Preparación | Definir el duelo inicial y el grupo de retadores. | Definir o sortear la fila inicial y revisarla. |
| Entre duelos | Resultado → selección de rival → preparación → inicio. | Resultado → siguiente de la fila → preparación → inicio. |
| Atractivo | Decisión del MC y tensión al anunciar su rival. | Ritmo ágil y previsibilidad para quienes esperan. |
| Riesgo de experiencia | Demoras o elección repetida de las mismas personas. | Esperas largas si crece la fila; aclarar cómo se reincorpora quien pierde. |
| Interfaz principal | «Elige a tu próximo rival» y tarjetas de elegibles. | «Ahora / Después» y fila completa. |

### A. El vencedor elige

Propuesta para revisar:

1. El host define el duelo inicial o se sortea entre los concursantes disponibles. Todavía no hay vencedor que pueda elegir.
2. Tras confirmar un resultado, solo el ganador de ese duelo puede elegir al próximo rival. Si el ganador cambia, el derecho a elegir pasa al nuevo ganador.
3. Mostrar únicamente retadores elegibles, presentes y disponibles para batallar. No permitir elegirse a sí mismo ni seleccionar a alguien que haya salido de la sesión.
4. El ganador selecciona y confirma; todos ven la elección. La elección no inicia automáticamente los turnos.
5. Comprobar disponibilidad de ambos y pasar a preparación. El host conserva el control de inicio.
6. Si el ganador no elige o se desconecta, mostrar «Selección pendiente». Propuesta de respaldo: pausa y luego sorteo entre elegibles confirmado por el host; duración y procedimiento pendientes de acordar.

Las personas que entran durante la sesión se incorporan al grupo de retadores disponibles. Propuesta pendiente: quien pierde puede volver a ofrecerse para batallar, pero evitar revancha inmediata si existen otros retadores disponibles. La elección repetida puede dejar a alguien esperando mucho tiempo; mostrar tiempo de espera y discutir una regla de prioridad antes de imponerla.

### B. Fila determinada

Propuesta para revisar:

1. El host ordena la fila inicial o la sortea antes de empezar. Todos pueden revisarla.
2. Las primeras dos personas disputan el duelo inicial. Las restantes forman la fila.
3. El ganador permanece y entra el primer retador pendiente. No puede elegir otra persona.
4. Mostrar quién viene después durante el duelo para que se prepare.
5. Propuesta: quien entra se añade al final; quien sale se retira de la fila sin alterar el orden del resto. Quien pierde puede volver al final si quiere seguir batallando. Estas reglas de reincorporación son propuestas, no decisiones confirmadas.
6. El host inicia el próximo duelo cuando ambos estén disponibles.

Ejemplo con orden A → B → C → D → E: empiezan A vs B; si gana B, sigue B vs C; si gana C, sigue C vs D. Haber perdido no impide a A y B seguir votando mientras permanezcan en la sesión y no sean los MC activos.

## Duración de la sesión — dos variantes solicitadas

La sesión admite nuevas personas y salidas en ambas duraciones. **Que la fila se vacíe no termina la sesión:** queda esperando retadores mientras siga habiendo personas presentes y no se haya alcanzado el límite elegido.

### 1. Con límite

Confirmado como variante; **el significado de «límite» sigue por acordar**. Alternativas para conversar:

| Límite posible | Ejemplo ilustrativo | Qué produce al alcanzarlo |
|---|---|---|
| Racha de victorias consecutivas | Defender la pista 5 veces seguidas. | El MC que alcanza el objetivo puede proclamarse campeón; definir si la victoria inicial cuenta para la racha. |
| Victorias acumuladas por persona | Llegar a 10 victorias durante la sesión. | Gana quien alcanza el objetivo, aunque haya perdido entre victorias. |
| Duelos completados en la sesión | Terminar después de 20 enfrentamientos. | Se termina la sesión, pero hace falta definir si se declara campeón y bajo qué criterio. |
| Tiempo de sesión | Jugar durante 60 minutos. | Hace falta acordar si el duelo en curso termina y cómo se determina el resultado global. |

Recomendación inicial para explorar: racha consecutiva, porque el objetivo está ligado a permanecer en pista. No se adopta todavía como límite definitivo. Los valores de la tabla son ejemplos.

Propuesta de cierre ordenado: si el límite depende de un resultado, comprobarlo después de confirmar el duelo. Si es de tiempo, dejar terminar el duelo ya iniciado y no abrir otro. Si todas las personas salen antes del objetivo, cerrar por sesión vacía y registrar «Objetivo no alcanzado», sin inventar un campeón.

### 2. Infinito

Confirmado por el usuario: sin meta de victorias, número de duelos ni tiempo máximo; continúa **hasta que todas las personas de la sesión se vayan**. Que salga el host o el rey, que quede una sola persona o que no haya retadores disponibles no equivale a sesión vacía.

Recomendación de presentación: «Rey actual», «Racha actual», «Mejor racha» e historial. Al vaciarse, mostrar un resumen de actividad sin declarar automáticamente campeón al último rey. El título de campeón en este modo no está acordado.

Propuesta pendiente para evitar cierres por cortes breves de conexión: distinguir salida voluntaria de desconexión temporal. Cerrar tras comprobar ausencia total y agotar un margen de reconexión, cuya duración se debe acordar. Si todavía hay alguien dentro, nunca cerrar por inactividad o fila vacía en este modo.

Hay que acordar qué cuenta como «persona de la sesión» a efectos del vacío: concursantes, host y también público externo. Recomendación: contar a todos los miembros presentes para respetar «hasta que todos se vayan»; solo concursantes ajenos al duelo votan.

### Cuatro combinaciones

| Próximo rival | Con límite | Infinito |
|---|---|---|
| El vencedor elige | El rey selecciona rivales hasta alcanzar la condición configurada. | El rey selecciona rivales mientras la sesión tenga personas. |
| Fila determinada | Entra el siguiente de la fila hasta alcanzar la condición configurada. | La fila evoluciona con entradas, salidas y reincorporaciones propuestas; no se cierra al vaciarse la fila. |

## Recorrido de creación propuesto

1. Elegir «Rey de la pista» y dar nombre a la sesión.
2. Compartir el acceso y recibir concursantes, usando perfiles o invitados. Se propone permitir crear la sesión vacía y exigir dos MC y al menos un concursante votante para iniciar un duelo.
3. Elegir **«El vencedor elige»** o **«Fila determinada»**.
4. Elegir **«Con límite»** o **«Infinito»**. Si es con límite, mostrar el objetivo y su valor una vez acordados los límites disponibles.
5. Revisar formato, voto de concursantes y desempate. En elección del vencedor, definir o sortear el duelo inicial; en fila, revisar el orden inicial.
6. Confirmar las reglas y comenzar cuando haya suficientes concursantes. La entrada de nuevas personas permanece abierta.
7. Entre duelos, pasar por la selección o por la fila según corresponda; mantener el contexto de sesión y los derechos de voto.
8. En modo con límite, cerrar al alcanzar la condición configurada; en infinito, al vaciarse la sesión. Mostrar el resumen que corresponda, sin confundir rey actual con campeón final.

## Estados que la experiencia debe distinguir

«Esperando en fila» o «Disponible para ser elegido», «Batallando», «En descanso, puede votar», «Público externo», «Desconectado temporalmente» y «Salió de la sesión». La inscripción, la disponibilidad para batallar y la presencia son datos distintos. Reincorporar al perdedor automáticamente o mediante «Volver a batallar» sigue pendiente; se recomienda una acción voluntaria.

Quien se desconecta deja de estar disponible para elegir o votar mientras esté ausente. Reconectar con la misma identidad no crea un concursante nuevo; cómo recuperar una votación ya abierta sigue pendiente de definir.

Si el rey sale entre duelos, la sesión continúa y se debe elegir un nuevo duelo inicial entre disponibles. Si un MC abandona durante su duelo, definir aparte si se anula o registra una derrota por abandono; no inferir el resultado de una desconexión breve. Si sale el host, acordar el relevo de control; la sesión infinita no termina por esa salida.

No iniciar un duelo sin concursantes votantes disponibles. Si no hay votos suficientes o hay empate, conservar el resultado pendiente y aplicar el procedimiento acordado antes de la sesión. No conceder al host un voto adicional para romper el empate por defecto.

## Decisiones abiertas

- ¿Qué significa el límite: racha consecutiva, victorias acumuladas, cantidad de duelos o tiempo?
- ¿Quien pierde vuelve al final o al grupo disponible automáticamente, o pulsa «Volver a batallar»? La participación abierta ya está confirmada; falta acordar esta mecánica.
- Confirmar la preparación del duelo inicial y el respaldo si el vencedor no selecciona rival.
- ¿Qué ocurre con empate o ausencia de votos? Recomendación para explorar: desempate definido antes del evento y estado pendiente visible si no hay resultado; el host no inventa un ganador por defecto.
- ¿Cómo tratar ausencia del siguiente retador? Proponer pausa o salto confirmado y visible; definir si la persona puede reincorporarse.
- Acordar margen de reconexión, integrantes que cuentan para sesión vacía y qué reconocimientos se muestran al cerrar cada duración.

## Cómo evaluar la propuesta

Simular ambas variantes con 5 participantes: cambios de ganador, empate, retador ausente y desconexión de un votante. En elección del vencedor, comprobar que el derecho de elegir pasa al nuevo ganador y que no se puede seleccionar a alguien no elegible; en fila, comprobar que se conserva el orden. Verificar que quienes perdieron pueden seguir votando si permanecen en sesión y que el público externo no puede hacerlo. Preguntar a MC, host y público si pueden identificar quién sigue y cómo termina el evento. Medir tiempo entre duelos y reasignaciones manuales de roles.

Cruzar esas pruebas con duración limitada e infinita. Añadir entradas durante un duelo, salida y regreso de un concursante, salida del rey y del host, fila vacía con personas presentes, una sola persona restante, vacío total y corte temporal de conexión de todos. Verificar que el objetivo limitado se aplica una sola vez y que infinito no cierra mientras quede alguien. Son escenarios propuestos, no pruebas ejecutadas.

## Fuentes locales

- `apps/web/src/app/tournament/page.tsx`: selección, orden y presentación actual.
- `apps/server/src/rooms/tournamentRoom.ts`: `king_of_the_hill`, creación y continuidad de duelos.
- `apps/server/src/rooms/battleRoom.ts`: inicio, padrón y voto de sala.
- `apps/web/src/components/BattleLobby.tsx`: bloqueo por jueces y resumen de votación.
- `apps/web/src/components/BattleModeSelector.tsx`: representación de sistemas de voto.
