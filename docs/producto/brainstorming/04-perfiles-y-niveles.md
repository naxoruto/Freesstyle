# 4. Perfiles y niveles

## Dirección confirmada

Cada persona tendrá **un nivel general y estadísticas por rol**: MC, juez, host y viewer. Esta preferencia está confirmada. Los campos solicitados son foto, nombre, AKA y crew; los detalles siguientes son propuestas para revisión.

El nivel representa participación en Freestyle Arena. Las victorias, derrotas, campeonatos y rachas representan resultados competitivos y se muestran aparte. Así una persona puede crecer en la comunidad tanto organizando y juzgando como batallando o siguiendo eventos.

## Punto de partida observado

Existen identidades y sesiones por sala, participantes de batallas en vivo y fichas de freestylers del catálogo externo. En los archivos revisados no aparece un sistema de cuentas de comunidad con avatar, crew y progresión global.

El perfil comunitario necesitará identidad persistente entre salas y dispositivos. Una sesión de sala no basta para acumular progreso de una persona. La ficha de un MC del catálogo tampoco equivale a una cuenta de ese MC: compartir un AKA no debe vincularlas automáticamente.

## Perfil mínimo propuesto

| Campo | Propuesta de experiencia | Obligación propuesta |
|---|---|---|
| Foto | Subir imagen, recortar, previsualizar, reemplazar y quitar. Mostrar iniciales si no hay foto. | Opcional. |
| Nombre | Nombre con el que la persona quiera presentarse; permitir controlar su visibilidad. | Opcional, sin exigir nombre legal. |
| AKA | Nombre protagonista en salas, carteles, cuadro e historial. | Obligatorio para el perfil. |
| Identificador público | Identificador único para distinguir personas con el mismo AKA. | Necesario al crear la cuenta; forma exacta pendiente. |
| Crew | Texto libre en la primera versión, con opción «Sin crew». Mostrarlo como dato declarado por la persona. | Opcional. |
| Nivel general | Número, barra y experiencia que falta para subir. | Calculado. |
| Estadísticas por rol | Batallas como MC, juzgadas, hosteadas y seguidas como viewer. | Calculadas desde actividad elegible. |

Para la foto, una entrega futura debe incluir progreso de carga, posibilidad de reintentar sin perder los demás datos y guardado explícito. Los límites y procesamiento del archivo se definirán con el trabajo de identidad y medios; este brainstorming no cambia esas piezas.

No exigir foto o crew para entrar a una batalla. Mantener invitado como acceso rápido es la recomendación inicial; la experiencia persistente empieza cuando existe una cuenta reconocible. No prometer recuperar actividad anónima anterior hasta definir cómo se vincula de manera fiable.

## Distribución de la página

1. Cabecera: foto, AKA, crew y nombre si es público.
2. Nivel general: barra de progreso y «Te faltan X XP para el nivel siguiente».
3. Cuatro contadores por rol, con nombres claros y posibilidad de abrir su historial.
4. Historial de batallas y eventos con resultado, fecha y papel desempeñado.
5. Logros sencillos y actividad reciente, solo después de contar con datos fiables.

Ejemplo ilustrativo: «AKA: Nexo · Crew: Sur · Nivel 6 · 18 batallas como MC · 9 juzgadas · 4 hosteadas · 27 seguidas como público». Son datos ficticios, no un perfil existente.

## Tres enfoques de progresión

| Enfoque | Ventaja | Coste o limitación |
|---|---|---|
| **Nivel general + estadísticas por rol — elegido** | Identidad sencilla y reconocimiento de todas las formas de participar. | Necesita explicar que el nivel no mide habilidad competitiva. |
| Niveles independientes por rol | Profundiza en cada forma de participación. | Introduce cuatro progresiones y más decisiones de equilibrio; no es la preferencia elegida. |
| Nivel general sin desglose | Muy fácil de presentar. | Oculta la contribución de jueces, hosts y público. |

## Qué cuenta como participación

Propuesta inicial: conceder XP al confirmar una batalla terminada que cumple las condiciones del rol. No dar XP por crear salas vacías, refrescar páginas o simplemente elegir un rol.

| Rol | Señal propuesta para contabilizar | Estadística principal |
|---|---|---|
| MC | Participó en el enfrentamiento y se completó un resultado válido. Ganar o perder da la misma base. | Batallas disputadas; victorias, derrotas y empates aparte. |
| Juez | Emitió los votos requeridos por el formato durante su participación elegible. | Batallas juzgadas, sin puntuar si coincidió con la mayoría. |
| Host | Tuvo el rol operativo y acompañó la conducción del enfrentamiento; ser admin por sí solo no basta. | Batallas hosteadas. |
| Viewer | Estuvo presente durante una parte suficiente del enfrentamiento y su cierre. | Batallas seguidas, con la limitación de medición indicada abajo. |

En Rey de la pista, por aclaración del usuario, votan los concursantes inscritos que no disputan el duelo actual; el público externo no vota. Emitir ese voto no equivale por sí solo a ejercer de juez ni concede otra recompensa de rol. Queda pendiente definir cómo registrar la participación de los concursantes mientras esperan o después de perder, evitando asignarles automáticamente XP de juez o viewer. Una persona que solo ocupa el rol de juez en otros modos, sin completar sus votos requeridos, no recibe automáticamente la recompensa de viewer como sustitución.

La señal de viewer mide **presencia registrada en la aplicación**, no atención real ni consumo audiovisual demostrado. La revisión no establece que exista reproducción de audio o video. No presentar «minutos vistos» como algo verificado si solo se conoce conexión a la sala.

## Modelo de XP para explorar

Los números de esta sección son una **hipótesis de equilibrio**, sin aprobar. Sirven para debatir y simular; no son requisitos definitivos.

| Acción elegible por batalla | XP de ejemplo |
|---|---:|
| Batallar | 50 |
| Juzgar | 40 |
| Hostear | 40 |
| Seguir como viewer | 10 |

Propuesta para evitar que acumular permisos sea una ventaja: una sola recompensa base por persona y batalla, tomando la mayor entre los roles elegibles. Si se desempeñó como host y juez, ambos contadores aumentan, pero se otorgan 40 XP en total. El contador de viewer se reserva a quienes participaron exclusivamente como público en esa batalla.

Las estadísticas por rol pueden solaparse entre host y juez; por eso no se suman para obtener «batallas únicas». Mostrar ese total por separado si hace falta.

Una curva ilustrativa de nivel sería:

`XP acumulada mínima para nivel L = 50 × L × (L − 1)`, con `L ≥ 1`.

| Nivel | XP acumulada mínima | Batallas como MC desde cero, usando 50 XP por batalla |
|---|---:|---:|
| 1 | 0 | 0 |
| 2 | 100 | 2 |
| 3 | 300 | 6 |
| 4 | 600 | 12 |
| 5 | 1.000 | 20 |
| 10 | 4.500 | 90 |

Con esta curva, un viewer con 10 XP por batalla necesita 10 encuentros elegibles para nivel 2. Eso puede resultar lento: probar su percepción antes de decidir los valores. Se puede ajustar el peso de cada rol sin cambiar la elección de un nivel general.

No añadir XP extra por ganar en la primera versión. Reconocer títulos y rachas con estadísticas o insignias, para conservar un nivel de participación comprensible. Si luego se desea ranking competitivo, diseñarlo como un sistema propio.

## Reglas de contabilización para debatir

- Una batalla nueva puede otorgar una recompensa nueva; una réplica dentro de la misma batalla no otorga otra recompensa base.
- Un encuentro de torneo cuenta una vez por su batalla; no volver a premiarlo al cerrar el torneo. Un reconocimiento de campeón puede ser una insignia.
- En Rey de la pista infinito, calcular participación y XP por duelo confirmado, sin esperar al cierre de la sesión. Conservar estadísticas aunque una persona salga o vuelva. La sesión puede seguir durante mucho tiempo y su cierre no es una fuente de XP adicional. Esta regla es una propuesta derivada de la sesión abierta acordada.
- Reconectar, usar dos pestañas o volver a recibir el resultado no crea otra recompensa. La actividad debe reconocer a la misma cuenta.
- Demos, salas canceladas, resultados anulados, pases por ausencia y enfrentamientos sin actividad suficiente no cuentan como batallas disputadas para XP.
- Ensayo inicial de elegibilidad: al menos una ronda completa con turnos de ambos MC y 2 minutos de actividad del enfrentamiento, sin contar la espera en lobby. Este mínimo es discutible y puede excluir formatos cortos válidos; medirlo antes de adoptarlo.
- Ensayo para viewer: presencia registrada durante al menos el 70 % del tiempo activo, incluyendo el cierre; intervalos de desconexión no suman. La base temporal excluye lobby y pausas. Estos valores también necesitan pruebas.
- Ensayo para host: acompañamiento registrado durante al menos el 70 % del tiempo activo; en avance manual, registrar además acciones de conducción. Resolver explícitamente relevos de host antes de implementar esta regla.
- Explorar un máximo de 5 recompensas diarias como viewer, por cuenta y día en `America/Santiago`. Informarlo en el resumen de progreso. Es una opción de equilibrio pendiente, no una decisión.
- Antes de publicar XP, evaluar también sesiones repetidas sin actividad real y encuentros entre las mismas cuentas. Los ejemplos anteriores no constituyen un sistema completo contra acumulación artificial.
- Al corregir un resultado, conservar el historial de concesión y ajuste del progreso, sin volver a concederlo desde cero. Mostrar al usuario por qué cambió.

En lugar de introducir todos los límites de inmediato, se puede mostrar primero el historial y contadores, observar patrones de uso y activar niveles con reglas explicadas cuando existan señales suficientes.

## Separación conceptual para una implementación futura

- **Cuenta:** identidad persistente y acceso.
- **Perfil:** nombre, AKA, foto, crew y visibilidad.
- **Participación:** relación de la cuenta con cada batalla y sus funciones reales, conservando una fotografía del AKA mostrado en el encuentro.
- **Progreso:** registro de XP concedida o ajustada, con motivo, batalla y versión de la regla utilizada.
- **Estadísticas:** contadores derivados de participaciones y resultados confirmados.

Separar estos conceptos permite cambiar el AKA o crew sin perder la historia y evita depender de comparar nombres para sumar actividad. Son límites de diseño propuestos; no se creó un esquema de datos ni una migración.

La crew será un campo libre inicialmente. Equipos con invitaciones, miembros, permisos, identidad propia y ranking implican otro subsistema y quedan fuera de la primera entrega.

## Cómo evaluar la propuesta

Probar creación y edición del perfil, AKA compartido por dos personas, cambio de crew, una cuenta en dos dispositivos y uso como invitado. Simular XP de una batalla, una réplica, un torneo y una reconexión. Comprobar que cada persona puede explicar por qué recibió su XP y qué le falta para subir.

Preguntas abiertas: cómo iniciar sesión, qué información del perfil será pública, si el historial será público por defecto y cuáles serán los valores finales de progresión. La arquitectura de acceso se revisará con el trabajo de seguridad al momento de implementar.

## Fuentes locales

- `packages/shared/src/identity.ts`: identidad y sesión por sala.
- `packages/shared/src/types.ts`: roles y entidades de participación.
- `apps/server/prisma/schema.prisma`: catálogo externo, sesiones y batallas en vivo.
- `apps/server/src/rooms/battleRoom.ts`: roles, resultados y votación.
- `apps/web/src/app/layout.tsx`: navegación actual, sin entrada de perfil.
