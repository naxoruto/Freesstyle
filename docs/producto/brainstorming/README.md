# Brainstorming de producto — Freestyle Arena

Esta carpeta conserva las notas previas de producto. La conversación actual comienza en [Estructura de la web y perfil](00-estructura-y-perfil.md), y el estado global se mantiene en el [registro de cambios](../CAMBIOS.md).

Fecha: 22 de noviembre de 2026.
Estado: primera revisión y propuestas para conversar; no es un diseño aprobado ni un plan de implementación.

## Alcance y aislamiento

Esta carpeta reúne la revisión de experiencia y las ideas solicitadas. Los planes anteriores se conservan en `docs/archivo/`; los contratos técnicos vigentes están enlazados desde `INDEX.md`. No se modificaron componentes, servicios, contratos, migraciones ni dependencias para elaborar esta propuesta.

La revisión se realizó leyendo el código local, incluidos cambios en curso. No se levantó la aplicación ni se probaron pantallas en navegador. Los hallazgos describen lo observado en esa lectura; los posibles defectos requieren reproducción antes de abrir trabajo de implementación. Como existen tareas paralelas, las referencias son una fotografía del momento y deben revisarse nuevamente al implementar.

## Orden de lectura

1. [Batalla individual](01-batalla-individual.md): creación, acceso, lobby y cierre.
2. [Torneo](02-torneo.md): configuración, participantes, cuadro y continuidad.
3. [Rey de pista](03-rey-de-pista.md): duelo actual, fila y reglas de cierre.
4. [Perfiles y niveles](04-perfiles-y-niveles.md): identidad, foto, nombre, AKA, crew y progresión.
5. [Prioridades y decisiones](05-prioridades-y-decisiones.md): alternativas, dependencias y orden sugerido.

## Preferencias confirmadas

- Revisar primero batalla individual, después torneo y después Rey de pista.
- Explorar perfiles con foto, nombre, AKA y crew.
- Reconocer la participación batallando, jueceando, hosteando y como viewer.
- **Un nivel general y estadísticas por rol**, confirmado durante esta conversación.
- En Rey de la pista votan los propios concursantes, excluyendo a los dos MC del duelo actual. Quienes ya perdieron siguen votando mientras permanezcan en la sesión. El público externo no forma parte de esa votación.
- Rey de la pista es una sesión abierta: las personas pueden entrar y salir durante el juego.
- Dos formas de elegir al próximo rival: **el vencedor elige** o **fila determinada**.
- Dos duraciones combinables con esas formas: **con límite** o **infinito hasta que todos se vayan**. El tipo de límite y la reincorporación después de perder siguen por acordar.
- Mantener este trabajo separado de las tareas actuales.

El resto son recomendaciones o preguntas abiertas. No se ha aprobado su implementación.

## Recomendación central

Conservar la rapidez de una batalla suelta, dar al torneo una página que se pueda retomar y presentar Rey de pista como una opción propia. Conectar después esas experiencias con un perfil persistente y un nivel de participación común a los cuatro roles.

El mismo perfil puede cambiar de rol entre batallas. Ni el nivel ni las estadísticas conceden permisos de juez, host o administrador.

## Qué validar al retomar

- Recorrer los tres modos en navegador con personas de distintos roles.
- Reconciliar las propuestas con los cambios de seguridad ya terminados.
- Elegir el alcance de la primera entrega antes de preparar especificaciones y tareas técnicas.
- Comprobar mejoras con sesiones de uso y métricas; todavía no existe una línea base medida para esta revisión.
