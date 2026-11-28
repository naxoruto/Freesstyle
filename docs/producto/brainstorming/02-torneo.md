# 2. Torneo

## Configuración compartida de batallas — 28 de noviembre de 2026

**Confirmado; pendiente de diseño completo e implementación.** El rediseño de configuración de batallas alcanza tanto torneo como 1vs1: quien crea avanza con «Siguiente», con opciones preseleccionadas, y puede editar después en la preparación previa al inicio. Detalle del recorrido y cuestiones abiertas en [configuración guiada](01-batalla-individual.md#configuración-guiada--decisión-del-28-de-noviembre-de-2026). Conservar la inscripción y confirmación de titulares del torneo; las notas anteriores de este archivo no sustituyen las decisiones vigentes de la especificación de torneo.

## Decisiones y temas abiertos del 23 de noviembre de 2026

Estado: brainstorming; todavía no implementado. Esta sección prevalece sobre las propuestas anteriores.

### Identidad del evento

Además del nombre, la creación debe permitir añadir **un logo del torneo** y **quién lo organiza**. El organizador puede ser una persona o una asociación. No se ha decidido todavía si esos campos son obligatorios, cómo se vinculan a un perfil o si el logo del evento es diferente del logo del organizador. No exigir una cuenta de asociación sin acordarlo.

### Modalidades separadas

**Rey de la pista no es un tipo de torneo**. Tiene su propio recorrido desde Inicio → Crear batalla → Rey de la pista. Debe retirarse como opción del formulario de torneo cuando se implemente el nuevo diseño. Los demás tipos de torneo todavía se están revisando.

### Inasistencias y repesca

El usuario solicita contemplar qué ocurre si alguien no llega y activar una repesca en esa situación. Esta regla está en definición: no se ha decidido si reemplaza al ausente alguien de una lista de reserva o un MC que ya había sido eliminado, quién confirma la ausencia ni en qué momento se puede cubrir el puesto.

No equiparar automáticamente esta repesca por inasistencia con la doble eliminación que existe en el código. Tampoco dar por aprobado un pase automático por ausencia: esa era una propuesta de la revisión anterior.

### Fila y acceso de participantes

Hay que definir cómo se arma la fila de quienes entran. Aún se debe distinguir la inscripción al evento, la selección de titulares y reservas y el orden de los enfrentamientos. Queda abierto si se ordena por inscripción, sorteo o decisión del organizador; no se ha elegido uno de esos criterios.

También sigue abierta la forma de inscribir participantes: nombres cargados por el organizador, inscripción mediante enlace o ambas. La petición de logo y organizador amplía los datos del evento, pero no resuelve por sí sola esa decisión.

Las secciones siguientes conservan la observación del código y recomendaciones anteriores; no son reglas aprobadas automáticamente.

## Flujo observado

Navegación «Torneos» → nombre → lista de alias, uno por línea → emparejamiento aleatorio o manual → tipo de torneo → crear → revisar participantes y, en manual, cruces → iniciar → abrir salas → registrar/recibir resultados → avanzar de fase.

La interfaz ofrece eliminación directa, tercer puesto, Rey de la pista y doble eliminación. El servidor dispone de avance a partir del resultado de las batallas, además del registro manual de ganador. No corresponde proponer «crear el bracket» o «automatizar todo el avance» como si aún no existieran.

## Hallazgos y mejoras propuestas

| Observado en el código | Implicación para la experiencia | Propuesta |
|---|---|---|
| El formulario comienza con cuatro alias de ejemplo ya escritos. | Se pueden crear participantes ficticios por accidente. | Campo vacío con ejemplo de formato y botón explícito «Cargar ejemplo». |
| Los participantes son nombres escritos por el organizador y reciben identificadores nuevos. | Aún no representan cuentas ni confirman presencia. | Distinguir «Invitado sin perfil», «Perfil vinculado» y «Presente». Añadir confirmación antes del inicio. |
| Los formatos se eligen tras compartir un mismo formulario. | Las restricciones y la explicación llegan tarde. | Elegir primero el tipo y adaptar después los pasos. |
| La ayuda enumera 4/8/16/32 y limita repesca a 16, pero las validaciones generales admiten más tamaños. | No hay una promesa de capacidad coherente. | Definir y mostrar los tamaños soportados por cada tipo tras validarlos. |
| La revisión manual muestra cruces; la aleatoria anuncia que sorteará al iniciar. | «Revisar el bracket antes de iniciar» no se cumple en el flujo aleatorio. | Separar «Sortear y revisar» de «Iniciar torneo». Mostrar cuándo queda confirmado el sorteo. |
| El frontend no ofrece configuración de batalla al iniciar, aunque el endpoint recibe formato y réplica. | No se pueden acordar las reglas desde este flujo. | Reutilizar presets y resumen de batalla; después ofrecer reglas distintas para la final. |
| Torneo y credencial de administración viven en estado React. El enlace de vuelta contiene `?id=…`, pero la página no lo carga. | La lectura del código indica que volver o recargar puede llevar al formulario en lugar del torneo. | Página identificable y recuperable del torneo; conservar acceso mediante el mecanismo que acuerde el trabajo de identidad. Validar navegando. |
| La página no se suscribe a actualizaciones ni vuelve a consultar el torneo durante la vista activa. | Un resultado que avanza en servidor puede no reflejarse en el cuadro abierto. | Actualización del cuadro y estado de conexión visibles. |
| Las salas nuevas se crean aparte de los puestos del cuadro; los enlaces intentan transportar identidad y rol. | Hay que verificar que llegar a una sala ubique realmente a cada MC y mantenga la asignación autorizada. | Una inscripción de evento que conecte al perfil o invitado con su puesto y sus siguientes batallas. |
| «Abrir sala» usa la identidad visible «Host» y solicita entrar también como juez. | Puede no coincidir con quién organiza ni con el papel que desea tomar. | Conservar identidad y elegir la función operativa explícitamente. |
| Cada cruce pendiente ofrece botones «Ganó…». | El registro administrativo se confunde con el resultado del enfrentamiento. | Priorizar el resultado emitido por la batalla; separar «Registrar resultado externo» con confirmación y procedencia visible. |

## Recorrido propuesto

1. Elegir eliminación directa, tercer puesto o doble eliminación. Rey de pista tendrá su entrada propia.
2. Nombrar el evento y elegir capacidad admitida y reglas de batalla.
3. Añadir perfiles o invitados; conservar la carga masiva de alias para organizar rápido.
4. Compartir acceso al evento, confirmar participantes y completar jueces/host.
5. Ordenar cruces manualmente o sortear; revisar y confirmar el cuadro antes de empezar.
6. Organizar desde una página estable con «En curso», «Siguiente batalla», participantes pendientes y cuadro completo.
7. Entrar a la sala correspondiente y volver al mismo torneo conservando su contexto.
8. Avanzar a partir de resultados confirmados; mostrar campeón, posiciones disponibles e historial al terminar.

## Representación del torneo

**Recomendada:** panel de «Ahora / Después» más cuadro consultable. En móvil, comenzar por la batalla relevante y permitir abrir cada fase. En escritorio, aprovechar un cuadro más amplio.

**Alternativa:** cuadro como única pantalla principal. Da una visión global inmediata, pero suele exigir más navegación en teléfono. Mantener una vista por lista como opción accesible.

No es necesario permitir batallas simultáneas en la primera mejora. Antes hay que decidir si el evento opera con una sola mesa/escenario o con varias salas paralelas.

## Casos de cierre que conviene reproducir

- **Tercer puesto:** el código obtiene perdedores desde `phases[0]` al cerrar la final y marca el torneo terminado. Revisar con 8 participantes si identifica las semifinales correctas y permite completar la disputa por tercero. Es un hallazgo estático, no una prueba ejecutada.
- **Empate:** el avance automático consultado solo registra un ganador si los puntajes finales son distintos. Mostrar «Desempate pendiente» cuando no exista ganador, sin hacer avanzar el cuadro arbitrariamente.
- **Reinicio del servicio:** el gestor de torneos guarda eventos y credenciales en mapas en memoria; la persistencia de batallas no equivale a persistencia del torneo completo.
- **Cancelación:** «Cancelar» en setup vuelve al formulario y descarta el estado local. Definir borrador, abandonar configuración y cancelar evento como acciones distintas.
- **Inasistencia:** documentar cómo se registra un pase por ausencia y cómo aparece en el historial. No adjudicar XP de batalla disputada por un pase automático.

## Primera entrega sugerida

Recuperación del torneo, retorno desde la batalla, cuadro actualizado, revisión real antes del inicio y reglas visibles. Dejar pases para cantidades arbitrarias, inscripciones públicas y personalización por todas las fases para entregas posteriores.

## Cómo evaluar la propuesta

Recorrer un torneo de 4 y otro de 8 personas, volver desde una sala, recargar y consultar desde otro dispositivo. Observar si el organizador identifica la siguiente acción sin asistencia y si todos ven los mismos resultados. Medir abandonos durante configuración y tiempo entre una batalla terminada y la siguiente iniciada.

## Fuentes locales

- `apps/web/src/app/tournament/page.tsx`: formulario, revisión y panel activo.
- `apps/server/src/rooms/tournamentRoom.ts`: tamaños, sorteo, salas y avance.
- `apps/server/src/index.ts`: API y conexión entre resultado de batalla y torneo.
- `apps/web/src/app/battle/[id]/page.tsx`: retorno mediante `?id=`.
- `packages/shared/src/types.ts`: contratos de torneo y fases.
