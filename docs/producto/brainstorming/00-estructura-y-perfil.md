# Estructura de la web y perfil

Estado: brainstorming activo. Este documento registra la conversación; no autoriza todavía una implementación de la nueva experiencia.

## Lo solicitado ahora

- Cambiar o mejorar las secciones de batalla individual, torneos y Rey de la pista.
- Incorporar un perfil personal.
- Permitir registrarse con Google o con un correo.
- Poder añadir una foto al perfil.
- Permitir participar como invitado indicando un nombre, o con una cuenta que conserve perfil e historial.
- Afinar las ideas y documentarlas antes de implementar.

## Antecedentes

Las [notas anteriores](README.md) exploran flujos, perfiles, crew, nivel general y estadísticas por rol. Se conservan y se revisarán junto con estas decisiones nuevas. El detalle de cuentas todavía no está implementado por el hecho de haber sido propuesto.

## Primeras decisiones por resolver

1. Acceso: participación como invitado con nombre o con cuenta para perfil e historial, confirmado. Definir después si crear y administrar eventos tiene requisitos adicionales.
2. Navegación: confirmado «Crear batalla» → elegir 1vs1, torneo o Rey de la pista; falta ubicar el perfil y detallar los recorridos de torneo y Rey de la pista.
3. Cada experiencia: creación, preparación, participación, seguimiento y finalización.
4. Perfil: campos obligatorios y opcionales, foto, privacidad y edición.
5. Registro: qué significa acceso por correo —contraseña o enlace de acceso— y cómo vincularlo con Google.
6. Datos: qué historial pertenece a la cuenta y cómo tratar participaciones previas como invitado.

Las estadísticas y los niveles reconocen participación; no deben conceder automáticamente permisos de administrador, host o juez.

## Método de trabajo

Resolver una decisión por vez, comparar alternativas y anotar la elegida. Después escribir el alcance de la primera entrega con recorridos y criterios de aceptación. La persistencia de torneos y el perfil deben coordinarse con el contrato de sesiones existente.

## Decisiones confirmadas

Está confirmado el acceso como invitado con nombre y el uso de cuenta para conservar perfil e historial. La cuenta podrá registrarse con Google o correo. Los campos del perfil y la ubicación del acceso a la cuenta siguen abiertos.

El 23 de noviembre de 2026 se confirmó que el problema principal del acceso a creación está en Inicio: «Crear batalla» debe abrir una elección entre **1vs1, torneo y Rey de la pista**. Después de elegir 1vs1 se pide el nickname o nombre de MC. No se ha solicitado adelantar la configuración ni eliminar la confirmación de sala creada; el usuario considera correcto el resto del recorrido descrito.

En el 1vs1, host y público son opcionales. Los puestos de MC y la administración siguen siendo necesarios. El lobby incluirá el selector **Batalla con jueces / Exhibición** junto al formato. Exhibición no requiere juez ni puntaje de jueces y termina sin ganador oficial; quedará seleccionada cuando solo estén los dos MC. Si entran más personas, se conserva la modalidad: solo el administrador puede cambiarla antes del inicio. La presentación visual del cierre se concretará en la especificación. Estas decisiones están documentadas y todavía no implementadas.

## Conversación siguiente

La revisión ha pasado a torneos. Se solicita añadir logo y organizador —persona o asociación— además del nombre. Rey de la pista queda como modalidad independiente, fuera de los tipos de torneo. Siguen por acordar la repesca cuando alguien no llega y la organización de la fila de participantes. Consultar las [decisiones de torneo](02-torneo.md).

Después se revisarán Rey de la pista y el detalle del perfil. El acceso de invitados queda como regla común de los tres modos.
