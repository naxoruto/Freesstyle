# Plan de Trabajo — Freestyle Arena

> **Estado:** Plan consolidado (noviembre 2026). Integra producto y técnica, con jerarquía y dependencias.
>
> **Origen:** auditoría de código + brainstorming de producto. Todas las recomendaciones fueron confirmadas por el usuario.
>
> **Regla de oro:** este plan complementa el [registro central](producto/CAMBIOS.md), no compite con él. La prioridad de producto (batalla individual → torneo → Rey de la pista → perfil → niveles) sigue mandando; el trabajo técnico se intercala como habilitador.

## 1. Cómo leer este plan

- **Fases 0–5** son entregas verificables, en el orden acordado de producto.
- **Track técnico** (§10) agrupa el trabajo de ingeniería (refactor, consistencia, DX) y dice en qué fase se ejecuta y qué habilita.
- Cada fase termina con un entregable comprobable. Se puede avanzar en tareas con decisiones cerradas aunque queden detalles de otras tareas por definir; esos detalles se resuelven antes de implementar el comportamiento afectado.
- En las tablas de producto, ✅ significa **alcance confirmado**, no implementación terminada. El avance real se consulta en el [registro central](producto/CAMBIOS.md) y en los planes de implementación de cada fase.
- IDs referenciados: `C` (cambiar), `A` (agregar), `Q` (quitar) para producto; `LIM`, `SEG`, `SRV`, `WEB`, `DX` para técnica.

## 2. Global Constraints

- No exponer `.env` ni credenciales. No borrar secretos ni migraciones.
- Preservar los cambios existentes del usuario.
- Pruebas que crean/eliminan registros → base **descartable** (ver [ENTORNO_LOCAL.md](ENTORNO_LOCAL.md)).
- Las decisiones abiertas no autorizan implementación hasta registrarse en `CAMBIOS.md`.
- Línea base verificable: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## 3. Resumen de fases

| Fase | Nombre | Objetivo | Depende de | Entrega verificable |
|---|---|---|---|---|
| 0 | Cimientos | Higiene, seguridad y consistencia | — | `pnpm check` verde + residuos limpios |
| 1 | Batalla individual | Rediseñar el flujo 1vs1 | Fase 0 + decisiones de batalla | Recorrido completo 1vs1 (crear→lobby→jugar→cerrar) |
| 2 | Torneo | Torneo recuperable, claro y en vivo | Fase 1 + decisiones de torneo | Torneo de 4 y 8 recuperable tras recargar |
| 3 | Rey de la pista | Sesión abierta con voto de concursantes | Fase 2 + decisiones de Rey | Sesión abierta con entradas/salidas y voto correcto |
| 4 | Perfil y cuentas | Identidad persistente (Google/correo + foto) | Fases 1–3 + decisiones de perfil | Registro + perfil con foto e historial |
| 5 | Niveles y progresión | Nivel general + estadísticas por rol | Fase 4 + decisiones de XP | XP y stats por rol calculados |
| T | Track técnico transversal | Refactor, DX y CI | Intercalado (ver §10) | — |

---

## 4. Fase 0 — Cimientos

> Higiene de bajo riesgo + correcciones de seguridad/consistencia que son **prerrequisito** del resto. Sin cambios visibles de comportamiento (salvo SEG que solo hace *detectar* fallos que hoy se silencian).

### 4.1 Higiene (LIM)

| ID | Tarea | Esfuerzo |
|---|---|---|
| LIM-01 | Sacar `apps/web/tsconfig.tsbuildinfo` de git (`git rm --cached`) | S |
| LIM-02 | Eliminar `.local-backups/` del disco (dump con credenciales) | S |
| LIM-03 | Terminar y verificar la reorganización de docs (rutas viejas) | M |
| LIM-04 | Limpiar Makefile (Redis fantasma, IP hardcodeada, `git checkout -- nginx.conf`) | S |
| LIM-05 | Externalizar secretos de docker-compose (`freestyle123` → env) | S |
| LIM-06 | ESLint real en el servidor (hoy `lint` = `typecheck`) | M |

### 4.2 Seguridad y consistencia

| ID | Tarea | Nota |
|---|---|---|
| SEG-01 | Eliminar deriva memoria↔BD (fire-and-forget → durable con bloqueo) | Prerrequisito de SRV-01 |
| SEG-05 | Mayor entropía del ID de batalla (8 hex → base36, sin lowercase) | |

### 4.3 Criterios de aceptación
- `git status` limpio de artefactos; `git grep` sin rutas viejas; `make help` sin Redis.
- `pnpm check` verde; server con ESLint corriendo.

---

## 5. Fase 1 — Batalla individual (primera entrega)

**Objetivo:** recorrido de 1vs1 sin fricciones: crear rápido, lobby claro, requisitos según modo, exhibición, cierre con revancha.

**Avance (25 de noviembre de 2026):** producto T1–T11 y pulido entregados; T12 (refactor WEB-01) sigue pendiente. Ver [plan de implementación](producto/planes/batalla-individual.md).

**Revisión manual del 26 de noviembre de 2026:** implementados los seis ajustes del lobby: copia sin desplazamiento, formato en modal, host opcional, MC presenciales sin dispositivo, tarjetas de personas/roles e invitación superior unificada. `Dialog` es una primitiva compartida, reutilizada también en la cartelera. Reglas y límites de verificación en [especificación §13](producto/specs/batalla-individual.md). Falta recorrido visual y persistencia con PostgreSQL disponible.

### 5.1 Decisiones resueltas

- Seguimiento del 26/11: tarjetas de personas compactadas a 140 px. Confirmado método de votación individual por juez, separado del formato; un único voto final por juez al terminar todas las rondas, igual peso y decisión por mayoría. Confirmado cálculo automático desde los puntos de rúbrica/patrón; pendiente repasar tablas y ejemplos. Preparación confirmada: cada juez elige método, revisa su vista y pulsa «Estoy listo»; todos deben estar listos antes de que el organizador active el «3, 2, 1». Detalle en [especificación §13](producto/specs/batalla-individual.md).
- Los nombres de presets (A9) y el resumen de reglas (C7) quedaron definidos e implementados en la entrega de batalla individual.

### 5.2 Entregables de producto

Votación clásica FMS (antes descrita como rúbrica): tabla por ronda con una fila por MC, casillas según sus entradas y agregados Escena/Flow para la ronda completa. Escalas de 0 a 4 en pasos de 0,5. Suma directa de patrones + Escena + Flow, sin multiplicadores; máximo de 24 puntos por MC y ronda con cuatro patrones. Confirmado: sumar todas las rondas y emitir el voto de cada juez al mayor total; empate exacto significa voto de réplica. En réplicas todos usan obligatoriamente voto libre: pueden pedir otra solo si quedan disponibles según el límite; al agotarlas eligen MC1/MC2. Confirmado: si un juez empata en FMS y no quedan réplicas permitidas, pasa a voto libre obligatorio entre MC1/MC2. Confirmado: 2 votos a MC1, 2 a MC2 y 1 a réplica producen réplica si queda alguna permitida. Confirmada mayoría absoluta: gana quien obtiene más de la mitad de los votos; si ninguno la alcanza, réplica mientras esté permitida. La alternativa «por patrón» se redefine como votación por rondas: nota entera de 0 a 10 por MC y ronda, con dos subcategorías confirmadas a elegir: rondas ganadas o puntaje acumulado (nombres propuestos). Voto libre elige un MC al cierre de la batalla completa. Confirmado desempate final de ambas subcategorías igual que FMS: réplica si queda alguna permitida; si no, elección MC1/MC2 por voto libre. Confirmada escala por rondas solo con enteros. Confirmado que una ronda empatada no suma una victoria a ninguno en «Rondas ganadas». Preparación confirmada mediante «Estoy listo» de todos los jueces y posterior inicio del organizador. Confirmado bloqueo de cambios voluntarios de método/subcategoría durante la batalla, manteniendo las transiciones obligatorias a voto libre. Confirmado: cambiar método/subcategoría antes de iniciar anula el «Estoy listo» de ese juez; cambiar el formato anula el de todos, que deben confirmar nuevamente. Reglas principales de esta revisión cerradas; especificación en §13. La nueva experiencia no está implementada.

| ID | Entregable | Alcance de producto |
|---|---|---|
| C1 | «Crear batalla» → elección 1vs1 / torneo / Rey de la pista | ✅ DEC-005 |
| C2 | Perfil en la navegación | ✅ |
| C3 | Entrar directo al lobby (sin pantalla «Sala creada») | ✅ |
| C4 | Bloque «Invitar» unificado (enlace + código + QR) | ✅ |
| C5 | Nickname después de elegir 1vs1 | ✅ DEC-006 |
| C6 | «Tu AKA o nombre visible» (quien crea entra como admin) | ✅ |
| C7 | Resumen de reglas legible antes de crear | ✅ |
| C8 | Selector «Batalla con jueces / Exhibición» en el lobby | ✅ DEC-008/010/011 |
| C9 | Requisitos de inicio según modo/votación | ✅ |
| C10 | Mensaje de jueces «1, 3 o 5» + si hay 2: «sobra 1 o falta 1» | ✅ |
| C11 | Distinguir «rol» de «permisos de organización» | ✅ |
| C12 | Resumen real de réplica («Hasta N · diferencia X · formato Y») | ✅ |
| C13 | Cierre con «Revancha» y «Repetir formato» | ✅ |
| C14 | Alinear opciones de tiempo (1/2 min y validación 30/45/90) | ✅ |
| C15 | Indicar «Formato personalizado» al salir de un preset | ✅ |
| C32 | Eliminar entrada por query params (identidad/rol) | ✅ = SEG-02 |
| C33 | `adminToken` fuera de `sessionStorage` | ✅ = SEG-03 |
| A8 | Cierre de Exhibición sin ganador ni puntaje | ✅ DEC-009 |
| A9 | Presets: «Rápida», «Con conceptos», «Por entradas» | ✅ |
| A10 | QR de invitación (posterior) | ✅ |
| Q2 | Quitar pantalla intermedia «Sala creada» | ✅ |
| Q4 | Quitar entrada por query params | ✅ |

### 5.3 Habilitadores técnicos (se ejecutan en esta fase)

El usuario aprobó la [vista de juez](producto/propuestas/vista-juez.html) el 27/11: incluye FMS centrada en la ronda actual con acceso a anteriores, por rondas y voto libre. Conserva contexto de ronda/turno/reloj y cambia el área de puntuación. La maqueta usa datos ficticios; la integración reutilizará las primitivas UI existentes. Los bloques JV del [plan especializado](producto/planes/batalla-individual.md) ordenan la implementación. Se confirma edición de notas de rondas anteriores hasta el voto final y cierre mediante «Confirmar planilla». Se amplía el alcance con votación en vivo/privada y veredicto solo al host/para todos, con consulta de votos por juez. En vivo se confirman notas provisionales/corregidas y votos finales visibles para el público, excluidos los MC que compiten; en privado, tras el anuncio, todos ven solo ganador y votos individuales, sin notas ni tablas. En modo solo host, el botón «Veredicto anunciado» libera ese resumen para los demás; si el host se desconecta antes de anunciar, el organizador puede reemplazarlo y usar ese botón. Se confirma aislamiento entre jueces: solo notas propias, sin notas ni votos ajenos antes de confirmar su voto final, incluso en modo en vivo. Se confirma que, sin host desde la configuración inicial, el organizador puede recibir y anunciar el veredicto con el mismo botón. Se confirma voto secreto de forma predeterminada en nuevas batallas, modificable a votación en vivo antes del inicio. Se confirma mostrar automáticamente el ganador a todos por defecto, con consulta de votos individuales, y conservar el anuncio manual del host/organizador como alternativa configurable antes de empezar. Ambas opciones permanecen independientes. JV-07 contempla la autorización de datos en servidor antes de integrar las nuevas vistas.
- **WEB-03** capa de cliente compartida → luego **WEB-01** split de `battle/[id]/page.tsx`.
- **SEG-02** y **SEG-03** (flujo de entrada por invitación + token seguro).
- **SRV-02** extracción de handlers de socket (los nuevos eventos de batalla entran ordenados).

### 5.4 Criterios de aceptación
- Una persona sin conocer la app crea, comparte y completa el cartel sin ayuda; registra tiempo hasta compartir e iniciar.
- Exhibición: dos MC pueden iniciar sin juez y el cierre no muestra ganador.
- Sin `role`/`alias`/`userId` en URLs; `adminToken` no accesible desde JS.

---

## 6. Fase 2 — Torneo

**Objetivo:** torneo recuperable y claro: identidad del evento, sorteo revisable, cuadro en vivo y retorno desde cada batalla.

**Avance (25 de noviembre de 2026):** T1–T8 (servidor), T9 (formulario web), T10 (inscripción guiada) y T10b (enlace público) entregados; T11 está en implementación y T12–T13 siguen pendientes. TOR-01 cubre el núcleo de persistencia. Ver [plan de implementación](producto/planes/torneo.md).

### 6.1 Decisiones y límites de esta entrega
- La [especificación de torneo](producto/specs/torneo.md) define nombre obligatorio, logo y organizador opcionales, inscripción manual y por enlace, suplentes por orden de inscripción, sorteo ajustable por el organizador y ausencia confirmada por este. La autoinscripción por enlace está implementada (T10b).
- T10b solicita el nombre obligatorio del invitado; la vinculación opcional con una cuenta se abordará con perfiles y cuentas.
- Sin suplentes disponibles, el tratamiento de una ausencia requiere una decisión del organizador; no se supone un pase automático.
- Varias salas simultáneas quedan fuera de la primera entrega; definir su operación antes de incorporarlas.

### 6.2 Entregables de producto

| ID | Entregable | Alcance de producto |
|---|---|---|
| C16 | Sacar «Rey de la pista» del formulario de torneo | ✅ DEC-013 |
| C17 | Logo + organizador (persona o asociación) | ✅ DEC-012 |
| C18 | Campo de participantes vacío + botón «Cargar ejemplo» | ✅ |
| C19 | Elegir tipo primero y adaptar los pasos | ✅ |
| C20 | Tamaños soportados coherentes por tipo | ✅ |
| C21 | Separar «Sortear y revisar» de «Iniciar» | ✅ |
| C22 | Página de torneo recuperable (recargar no la pierde) | ✅; TOR-01 cubre solo el núcleo |
| C23 | Cuadro actualizado en vivo | ✅ |
| C24 | Configuración de batalla visible al iniciar | ✅ |
| C25 | Repesca por inasistencia | ✅ DEC-014 |
| A11 | Panel «Ahora / Después» + cuadro consultable | ✅ |
| A12 | Inscripción al evento (perfil/invitado ↔ puesto ↔ siguientes batallas) | ✅ |
| A13 | Confirmar participantes antes del inicio | ✅ |
| Q1 | Quitar Rey de la pista del formulario | ✅ |
| Q3 | Quitar los 4 aliases de ejemplo precargados | ✅ |

### 6.3 Habilitadores técnicos
- **TOR-01** persistencia y recuperación del torneo (modelo, credenciales, relación con batallas, resultados idempotentes).
- **WEB-02** split de `tournament/page.tsx`.
- **UI-01** inventario y contrato del sistema visual compartido (este plan + [guía de componentes UI](producto/GUIA_COMPONENTES_UI.md)); prerrequisito para extender o dividir componentes de interfaz.
- **SEG-04** expiración/rotación de invitaciones (para inscripción por enlace).

### 6.4 Criterios de aceptación
- Recorrer torneo de 4 y 8, volver desde una sala, recargar y consultar desde otro dispositivo.
- Todos ven los mismos resultados; el organizador identifica la siguiente acción sin ayuda.
- Cierre correcto de tercer puesto y empate (reproducir antes de corregir).

---

## 7. Fase 3 — Rey de la pista

**Objetivo:** sesión abierta con entradas/salidas, voto de concursantes (no público), dos formas de elegir rival y dos duraciones.

### 7.1 Decisiones por cerrar
- Significado del «límite»: racha / victorias acumuladas / duelos / tiempo (A15)
- Reincorporación del perdedor: automática vs «Volver a batallar» (A16)
- Empate / ausencia de votos: desempate acordado + estado pendiente (A16)
- Margen de reconexión y definición de «sesión vacía» (A17)

### 7.2 Entregables de producto

| ID | Entregable | Alcance de producto |
|---|---|---|
| C26 | Entrada propia desde Inicio, con explicación de una frase | ✅ |
| C27 | Admitir 3, 5, 6… participantes (sin potencias de 2) | ✅ |
| C28 | No exigir jurado externo (votan concursantes ajenos al duelo) | ✅ |
| C29 | Mostrar «Voto de concursantes» y quién puede votar | ✅ |
| C30 | Destacar ocupante / retador / siguiente / fila | ✅ |
| C31 | Continuidad de sesión entre duelos (sin sala nueva por duelo) | ✅ |
| A14 | «El vencedor elige» y «Fila determinada» | ✅ |
| A15 | «Con límite» / «Infinito» | ✅ |
| A16 | Estados visibles (en fila, disponible, batallando, en descanso, público, desconectado, salió) | ✅ |
| A17 | Campeón solo en modo con límite; en infinito «Rey actual» + rachas | ✅ |

### 7.3 Habilitadores técnicos
- Vínculo **padrón de votación ↔ inscripción al evento** (hoy el voto de sala no comprueba que el votante esté inscrito).
- Sesión abierta: inscripción, disponibilidad y presencia como datos distintos.

### 7.4 Criterios de aceptación
- Simular ambas variantes (elección y fila) con 5 participantes: cambio de ganador, empate, retador ausente, desconexión de votante.
- Quienes perdieron siguen votando si permanecen; el público externo no vota.
- Infinito no cierra mientras quede alguien; con límite, el objetivo se aplica una sola vez.

---

## 8. Fase 4 — Perfil y cuentas

**Objetivo:** identidad persistente entre salas y dispositivos: registro con Google o correo, foto, nombre, AKA y crew.

### 8.1 Decisiones por cerrar
- Campos obligatorios/opcionales, visibilidad y edición (A3)
- Registro por correo: contraseña vs enlace de acceso; vínculo con Google (A1)
- Tratamiento del historial previo como invitado (migración a cuenta)

### 8.2 Entregables de producto

| ID | Entregable | Alcance de producto |
|---|---|---|
| A1 | Registro con Google o correo | ✅ DEC-002 |
| A2 | Foto de perfil (subir, recortar, quitar; iniciales si no hay) | ✅ |
| A3 | Nombre + AKA + crew (crew como texto libre) | ✅ |
| A4 | Nivel general + estadísticas por rol (MC, juez, host, viewer) | ✅ |
| A5 | Historial de batallas/eventos (resultado, fecha, papel) | ✅ |
| A6 | Invitado con nombre (regla común a los 3 modos) | ✅ DEC-004 |
| A7 | Identificador público único (AKAs repetidos) | ✅ |

### 8.3 Habilitadores técnicos
- Autenticación (Google/correo) y esquema de cuentas (Prisma).
- Subida y procesamiento de imagen.
- Separación conceptual: **cuenta / perfil / participación / progreso / estadísticas**.

### 8.4 Criterios de aceptación
- Crear/editar perfil, dos personas con el mismo AKA, cambio de crew, una cuenta en dos dispositivos, uso como invitado.
- Cada persona puede explicar qué XP recibió y por qué (en Fase 5).

---

## 9. Fase 5 — Niveles y progresión

**Objetivo:** nivel general + estadísticas por rol, motivando continuidad sin confundir nivel con habilidad competitiva.

### 9.1 Decisiones por cerrar
- Curva y valores de XP (los de `04-perfiles-y-niveles.md` son hipótesis sin aprobar)
- Reglas de contabilización (réplicas, torneos, Rey de pista, reconexión, máximos diarios)

### 9.2 Entregables
- Nivel general con barra y «Te faltan X XP».
- Contadores por rol (batallas como MC, juzgadas, hosteadas, seguidas).
- Historial con motivo de cada XP (concesión/ajuste) y versión de regla.

### 9.3 Criterios de aceptación
- Una réplica no duplica XP; un encuentro de torneo cuenta una vez; reconectar no vuelve a premiar.
- Viewer no se presenta como «minutos vistos» si solo se conoce conexión.

---

## 10. Track técnico transversal

> Trabajo de ingeniería que no pertenece a una sola fase de producto; se ejecuta en la fase indicada y habilita lo que se indica.

| ID | Tarea | Fase | Habilita |
|---|---|---|---|
| LIM-01..06 | Higiene (git, backups, Makefile, docker, ESLint) | 0 | base para todo |
| SEG-01 | Deriva memoria↔BD → durable con bloqueo | 0 | SRV-01, consistencia |
| SEG-05 | Entropía del ID de batalla | 0 | IDs estables |
| SEG-02 | Entrada solo por invitación (sin query params) | 1 | C32 |
| SEG-03 | `adminToken` → cookie httpOnly / token corto | 1 | C33 + Fase 4 |
| SEG-04 | Expiración/rotación de invitaciones | 2 | A12 |
| SRV-01 | Dividir `battleRoom.ts` (state/phaseMachine/voting/roles/recovery) | 0–1 | cambios de batalla seguros |
| SRV-02 | Extraer handlers de socket de `index.ts` | 1 | nuevos eventos ordenados |
| SRV-03 | Consolidar `submitX`/`submitXDurably` | 0–1 | menos duplicación |
| WEB-03 | Capa de cliente compartida (fetch + socket) | 1 | WEB-01/02 |
| WEB-01 | Dividir `battle/[id]/page.tsx` | 1 | mantenibilidad |
| WEB-02 | Dividir `tournament/page.tsx` | 2 | mantenibilidad |
| WEB-04 | Unificar estilos (`globals.css` vs Tailwind) | 1–2 | VIS-01 |
| DX-01 | Tests en frontend (vitest + testing-library) | continuo | |
| DX-02 | Logging estructurado (pino) | continuo | |
| DX-03 | CI mínima | continuo | |
| DX-04 | Limpiar `FIX Bug N` y logs residuales | 1–3 | |
| DX-05 | Lanzador Windows de frontend y backend con comprobación de PostgreSQL y migraciones | Entregado, 26/11/2026 | `Iniciar Freestyle.cmd`; arranque completo pendiente de revisión con PostgreSQL disponible |
| UI-01 | Auditoría de componentes existentes y reglas de reutilización | 0 (planificación) | Catálogo inicial y procedimiento acordado; [guía UI](producto/GUIA_COMPONENTES_UI.md) |
| UI-02 | Definir tokens visuales y componentes UI comunes | En curso; primera base implementada | Botones, campos, paneles y avisos; completar controles restantes y ejemplos |
| UI-03 | Migrar páginas por etapas y dividir composiciones grandes | En curso; Inicio, inscripción, creación/operación de torneo y pantallas de batalla migradas parcialmente | Reusar UI-02; WEB-01/02 quedan coordinados con esta migración |
| UI-04 | Mantener catálogo y revisar reutilización al planear cada funcionalidad | continuo | Actualizar guía e inventario con cada cambio de interfaz |

**Nota:** SEG-02/03/04 cambian comportamiento; se implementan cuando la decisión de producto correspondiente esté registrada (ver §12).

---

### 10.1 Sistema visual y reutilización de UI

**Configuración de batallas (28/11; en definición):** rediseñar el configurador compartido de 1vs1 y torneo con explicaciones sencillas. Recorrido confirmado: quien crea avanza con «Siguiente» y opciones preseleccionadas, llega al lobby y puede editar antes del inicio. Se confirma elegir la cantidad de rondas y dar a cada ronda su propio formato y cantidad de entradas; «formato» se desglosa en intercambio, patrones y contenido, según las opciones y restricciones del brainstorming. El diseño y los contratos deberán contemplar rondas diferentes. Falta acordar los pasos, las opciones y las preselecciones restantes; no implementar el diseño abierto como si estuviera aprobado. Conservar la inscripción del torneo y el método individual de cada juez. Reutilizar o extender el configurador y las primitivas del catálogo. Detalle en [brainstorming de batalla](producto/brainstorming/01-batalla-individual.md#configuración-guiada--decisión-del-28-de-noviembre-de-2026).

**Dependencia del rediseño:** contemplar 4x4/8x8/12x12/16x16, patrones 1–5 con mínimo 3 en 4x4 y 1 con ida y vuelta en 16x16, y los contenidos definidos (incluidos cambios de palabra y Deluxe). Se confirma 16x16 con un minuto en cada intervención A → B → B → A: cuatro minutos de rap. Se confirma 12x12 con 30 segundos por intervención y alternancia A → B → A → B…, sin imponer la inversión de la vuelta del 16x16. Orden confirmado: cantidad de patrones antes del formato. En 4x4, 8x8 y 12x12, N patrones son N intervenciones por MC alternando A/B. Se confirma mostrar los formatos incompatibles con la cantidad seleccionada visibles y deshabilitados, con explicación del requisito. Precisar la correspondencia con casillas FMS del 16x16, las combinaciones y el tratamiento de selecciones que se invalidan al volver atrás. Extender la configuración por ronda, el reloj, los conceptos y las tablas de evaluación; mantener compatibilidad explícita con salas e históricos anteriores. Con imagen sigue fuera de esta implementación inicial. Los bloques JV existentes necesitan reconciliarse con estas reglas antes de ejecutarse.

**Objetivo:** que los controles comunes se comporten y se vean de forma coherente en toda la web, y que las nuevas funcionalidades consulten primero el catálogo de componentes antes de añadir una implementación paralela.

El inventario inicial y el procedimiento de mantenimiento viven en [Guía de componentes UI](producto/GUIA_COMPONENTES_UI.md). La auditoría encontró componentes de dominio reutilizables, pero no una biblioteca compartida de controles básicos. La interfaz mezcla utilidades Tailwind, clases locales y estilos de página en `globals.css`; el trabajo debe consolidar primero los patrones compartidos y preservar tratamientos visuales específicos de cada producto donde sean intencionales.

Orden de ejecución:

1. **UI-01 — Auditoría (documentada):** registrar rutas, componentes, estilos comunes y oportunidades de extracción; distinguir controles transversales de composiciones de dominio.
2. **UI-02 — Fundamentos:** acordar tokens de color, tipografía, espaciado, bordes, foco y movimiento; crear componentes base accesibles con variantes explícitas (por ejemplo, botón principal, secundario, texto, peligro e icono; controles de formulario; paneles; avisos; estados vacíos).
3. **UI-03 — Migración por etapas:** aplicar las piezas base primero a flujos centrales y separar páginas grandes por secciones con límites de responsabilidad; no cambiar reglas de negocio al hacer refactor visual.
4. **UI-04 — Adopción continua:** antes de crear una pieza de UI, consultar la guía, reutilizar o extender un componente existente cuando encaje y registrar en la guía cualquier componente nuevo o excepción visual.
5. **Verificación:** comprobar consistencia de variantes, estados deshabilitados/carga, foco por teclado, diseño móvil, accesibilidad y ausencia de regresiones funcionales en cada etapa.

**Límite:** reutilizar no significa forzar todos los diseños en una única apariencia ni convertir cada fragmento JSX en componente. Catálogo, póster, demo y sala pueden conservar identidad propia; sus botones y campos sí deben usar variantes comunes cuando no exista una razón documentada para apartarse.

**Criterios de aceptación:** existe un catálogo vigente; los botones y controles comunes comparten variantes y estados; cada página migrada consume ese catálogo; los componentes de dominio siguen siendo composiciones reutilizables; las nuevas funcionalidades incluyen revisión de reutilización antes de añadir UI duplicada.

---

## 11. Mapa de dependencias

```
Fase 0 (LIM + SEG-01 + SEG-05)  ──►  SRV-01/03  ──►  SRV-02  ──►  WEB-03
UI-01 (inventario/contrato) ──► UI-02 (tokens/primitivas) ──► UI-03 + WEB-01/02
                                        │
Fase 1 (Batalla)  ──►  SEG-02, SEG-03  ─┘
        │
        ▼
Fase 2 (Torneo)  ──►  TOR-01, WEB-02, SEG-04
        │
        ▼
Fase 3 (Rey de la pista)  ──►  padrón↔inscripción, sesión abierta
        │
        ▼
Fase 4 (Perfil)  ──►  auth, cuentas, foto  (aprovecha SEG-03)
        │
        ▼
Fase 5 (Niveles)  ──►  XP, stats

DX-01..04, UI-04 y WEB-04: intercalados desde Fase 0
```

**Regla de avance:** el orden de fases marca la prioridad de producto, no exige terminar cada refactor antes de empezar la siguiente fase. T12/WEB-01 de batalla sigue pendiente mientras el torneo está en curso. Cada tarea que cambia comportamiento requiere sus decisiones concretas registradas antes de implementarse; los refactors (SRV/WEB) se intercalan según las dependencias reales.

---

## 12. Registro en CAMBIOS.md

Al ejecutar, registrar en `docs/producto/CAMBIOS.md`:

- Fases 1–5 como iniciativas con estado **Pendiente técnico** (o **En definición** mientras haya decisiones abiertas).
- Las decisiones nuevas confirmadas como `DEC-*`: conjunto de batalla (C1–C15, A8–A10, C32–C33), torneo (C16–C25, A11–A13), Rey de la pista (C26–C31, A14–A17), perfil (A1–A7) y transversal (A18–A24).
- No abrir un plan global que compita con este documento.

---

## 13. Qué NO hacer

- No iniciar una fase sin cerrar sus decisiones previas.
- No usar la base de desarrollo para pruebas que creen/eliminen registros.
- No borrar migraciones ni secretos.
- No mezclar un refactor con un cambio de producto: primero la decisión, luego el código.
