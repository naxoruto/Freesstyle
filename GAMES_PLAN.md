# Plan de Trabajo - Juegos Diarios de Freestyle

## 1. Vision

Construir una seccion de juegos diarios sobre freestyle competitivo, inspirada en
productos como Futbol11, 7a0 y Copero. El producto debe ser facil de jugar desde
el movil, compartible y util tambien como puerta de entrada a la historia del
freestyle.

El MVP incluye tres juegos:

1. Freestyler del dia.
2. Grid 3x3.
3. Draft de cinco MCs.

La primera entrega sera una vertical completa de **Freestyler del dia** con un
catalogo inicial de 30 perfiles. Los otros juegos se construiran despues de
validar esa experiencia.

## 2. Objetivos

- Ofrecer una razon diaria para volver al producto.
- Permitir jugar sin registro obligatorio.
- Crear resultados compartibles sin spoilers.
- Construir una base de datos propia y verificable sobre freestyle.
- Evitar dependencias en tiempo real de APIs o sitios externos.
- Preparar el dominio para futuros juegos, perfiles y modos sociales.

## 3. Alcance del MVP

### Incluido

- Catalogo curado de 100 a 150 freestylers para el lanzamiento completo.
- Argentina, Espana, Mexico, Chile, Peru y Colombia como paises iniciales.
- FMS y Red Bull Batalla como competiciones iniciales.
- Un desafio diario por cada juego.
- Juego responsive para movil y escritorio.
- Progreso anonimo persistido localmente.
- Resultados compartibles.
- Estadisticas globales anonimas basicas.
- Importacion de contenido mediante archivos JSON o CSV.
- Fuente y fecha de verificacion para los datos editoriales.

### Fuera del alcance inicial

- Registro e inicio de sesion.
- Ranking de usuarios.
- Multijugador en tiempo real.
- Aplicaciones moviles nativas.
- Simulacion realista de batallas.
- Scraping automatico continuo.
- Panel editorial completo.
- Monetizacion.

## 4. Principios de Producto

- El jugador debe entender las reglas antes de empezar.
- Una partida diaria debe durar entre 2 y 5 minutos.
- El resultado debe poder compartirse sin revelar respuestas.
- Toda respuesta debe ser explicable con datos visibles.
- Las valoraciones subjetivas deben evitarse o estar claramente justificadas.
- Los desafios diarios deben validarse antes de publicarse.
- El producto debe funcionar sin cuenta; la cuenta sera una mejora posterior.

## 5. Estado Tecnico Actual

El repositorio ya cuenta con:

- Monorepo administrado con pnpm y Turborepo.
- Frontend en Next.js 14 y React 18.
- Backend Express con Socket.IO.
- Redis para salas y estado en tiempo real.
- Paquete compartido de tipos TypeScript.
- Vitest para pruebas del servidor.
- Docker Compose para ejecucion local y produccion.

Los juegos diarios se incorporaran como un dominio independiente para no
acoplarlos al flujo de batallas en tiempo real.

## 6. Arquitectura Propuesta

```text
apps/web
  src/app/juegos/
  src/app/juegos/freestyler/
  src/app/juegos/grid/
  src/app/juegos/draft/

apps/server
  src/catalog/
  src/challenges/
  src/game-results/
  src/importers/

packages/shared
  tipos de catalogo
  tipos de desafios
  contratos de API
```

### Persistencia

- Agregar PostgreSQL como fuente persistente del catalogo y los desafios.
- Usar Prisma para esquema, migraciones, consultas y seeds.
- Mantener Redis para salas y funcionalidades en tiempo real.
- Usar `localStorage` para el progreso anonimo del jugador en el MVP.
- Registrar intentos globales de forma anonima y agregada.

### Fecha diaria

- Usar inicialmente la zona horaria `America/Argentina/Buenos_Aires`.
- Calcular una clave diaria estable con formato `YYYY-MM-DD`.
- Resolver la respuesta en el servidor.
- No enviar la solucion al navegador antes de terminar la partida.

## 7. Modelo de Datos Inicial

### Entidades

- `Freestyler`
- `Country`
- `Competition`
- `Season`
- `Participation`
- `Title`
- `Battle`
- `FreestylerTag`
- `DailyChallenge`
- `GameAttempt`
- `DataSource`

### Freestyler

```ts
interface Freestyler {
  id: string;
  slug: string;
  alias: string;
  normalizedAlias: string;
  realName?: string;
  countryId: string;
  birthDate?: string;
  debutYear?: number;
  active: boolean;
  imageUrl?: string;
  socialLinks: SocialLinks;
  verifiedAt?: string;
}
```

### Battle

```ts
interface Battle {
  id: string;
  competitor1Id: string;
  competitor2Id: string;
  winnerId?: string;
  competitionId: string;
  seasonId?: string;
  stage?: string;
  date?: string;
  hadReplica: boolean;
  videoUrl?: string;
}
```

### DailyChallenge

```ts
type DailyGame = "freestyler" | "grid" | "draft";

interface DailyChallenge {
  id: string;
  game: DailyGame;
  dateKey: string;
  status: "draft" | "validated" | "published";
  payload: unknown;
  createdAt: string;
  validatedAt?: string;
}
```

### Reglas de Normalizacion

- Cada freestyler tiene un `slug` unico.
- Los aliases se comparan sin distinguir mayusculas, acentos o espacios dobles.
- Paises y competiciones se referencian por ID, nunca como texto libre.
- Titulos y participaciones deben incluir competicion y temporada.
- Cada dato editorial debe poder asociarse a una fuente.
- Los duplicados se resuelven durante la importacion, no en la UI.

## 8. Fuentes de Datos

### Fuentes principales

- FMS REST API para perfiles y eventos: `https://fms.tv/wp-json/`.
- Sitio oficial de FMS para resultados y clasificaciones no disponibles en REST.
- Paginas oficiales de Red Bull Batalla para eventos y perfiles.
- Wikidata para identidad, aliases y nacionalidad.
- YouTube Data API para enlazar videos oficiales.

### Fuentes secundarias

- Freestyleros para resultados historicos, siempre con validacion cruzada.
- Dataset `FMS-Rap-Web-Scrape` como referencia historica, no como fuente unica.
- Wiki Rap/Fandom mediante su API MediaWiki, con atribucion CC BY-SA y sin usar
  sus imagenes.

### Politica de Uso

- No consultar sitios externos durante una partida.
- Importar, normalizar y revisar los datos antes de publicarlos.
- Respetar terminos de servicio y limites de trafico.
- No republicar fotos, marcas o transcripciones sin permisos adecuados.
- Empezar con aliases, banderas e imagenes autorizadas o propias.

## 9. Especificacion de Juegos

### 9.1 Freestyler del Dia

#### Flujo

1. El jugador busca y selecciona un alias.
2. El servidor compara la seleccion con la respuesta diaria.
3. La UI muestra pistas por atributo.
4. El jugador gana al acertar o pierde al agotar los intentos.
5. Se presenta contexto del freestyler y un resultado compartible.

#### Atributos iniciales

- Pais.
- Ano de nacimiento.
- Participaciones registradas.
- Participacion en FMS.
- Participacion internacional en Red Bull.
- Cantidad exacta de titulos registrados.

Los atributos numericos se muestran como anos o cantidades exactas, nunca como
rangos. La pista de pais usa una matriz geografica explicita: el mismo pais es
una coincidencia exacta, los paises proximos son cercanos y el resto son
diferentes. En anos y cantidades, una diferencia de un punto es cercana.

El campo `debutYear` existe en el modelo, pero no se activa como pista hasta que
la cobertura editorial sea suficiente. La medicion actual no encuentra perfiles
publicados con ese dato completo.

#### Reglas

- Ocho intentos.
- Coincidencia exacta, aproximada o incorrecta por atributo.
- Autocompletado sin exponer datos ocultos de la respuesta.
- Una sola partida diaria por dispositivo, con reinicio solo al cambiar la fecha.
- La respuesta no debe incluirse en el HTML ni en datos precargados.
- Los anos se muestran como anos exactos, nunca como rangos.
- La primera vertical usa aliases y banderas, sin fotografias de competidores.

#### Modo demo

La URL `/juegos/freestyler?demo=1` crea un desafio de demostracion separado del
reto publico. El perfil se sortea por sesion demo y el boton `Sortear otro`
genera una nueva sesion sin modificar las partidas normales.

### 9.2 Grid 3x3

#### Flujo

1. Se muestran tres condiciones de filas y tres de columnas.
2. El jugador completa cada cruce con un freestyler valido.
3. Un freestyler no puede repetirse dentro del grid.
4. Al finalizar se muestra precision y rareza de las respuestas.

#### Categorias iniciales

- Pais.
- Competicion.
- Temporada.
- Campeon.
- Finalista.
- Participacion internacional.

#### Reglas

- Las respuestas se validan en el servidor.
- Cada casilla debe tener varias respuestas posibles.
- Cada grid debe pasar una validacion automatica antes de publicarse.
- La rareza se calcula a partir de elecciones agregadas, no de valoraciones.

### 9.3 Draft de Cinco MCs

#### Flujo

1. El jugador recibe una condicion por ronda.
2. Se presentan candidatos validos.
3. El jugador elige uno y avanza.
4. Despues de cinco rondas se muestra el equipo y su puntuacion.

#### Condiciones iniciales

- Pais.
- Competicion.
- Generacion o periodo de debut.
- Participacion internacional.
- Restriccion de titulos.

#### Reglas

- Cinco selecciones por partida.
- Un freestyler no puede repetirse.
- La formula de puntuacion debe ser publica y entendible.
- El modo diario usa condiciones predefinidas y verificadas.
- El modo libre se considera una mejora posterior al MVP funcional.

## 10. API Inicial

Endpoints tentativos:

```text
GET  /api/catalog/freestylers?q=
GET  /api/catalog/freestylers/:slug
GET  /api/challenges/:game/today
POST /api/challenges/freestyler/guess
POST /api/challenges/grid/answer
POST /api/challenges/draft/select
POST /api/game-results
```

Principios de la API:

- Respuestas de error consistentes.
- Validacion de entrada en servidor.
- Rate limiting para endpoints de juego.
- No exponer soluciones en payloads, errores o metadatos.
- Contratos compartidos desde `packages/shared`.
- Las estadisticas anonimas no deben almacenar datos personales.

## 11. Fases de Ejecucion

### Fase 0 - Definicion

Duracion estimada: 1 a 2 dias.

- Definir nombre e identidad del producto.
- Confirmar paises y competiciones iniciales.
- Definir criterios editoriales.
- Decidir el tratamiento de imagenes.
- Crear wireframes de los tres juegos.
- Definir eventos de analitica.
- Cerrar reglas de Freestyler del dia.

**Salida:** alcance cerrado y reglas documentadas.

### Fase 1 - Catalogo

Duracion estimada: 4 a 6 dias.

- Incorporar PostgreSQL y Prisma.
- Crear esquema y migracion inicial.
- Crear importador JSON/CSV.
- Cargar 30 perfiles para la primera vertical.
- Normalizar paises, competiciones y titulos.
- Registrar fuente y fecha de verificacion.
- Agregar validaciones de duplicados.
- Exponer busqueda de freestylers desde la API.

**Salida:** catalogo inicial consultable y verificable.

### Fase 2 - Freestyler del Dia

Duracion estimada: 4 a 6 dias.

- Crear seleccion diaria determinista.
- Crear endpoint seguro de intentos.
- Implementar buscador por alias.
- Implementar comparacion de atributos.
- Mostrar historial de intentos y pistas.
- Persistir la partida en `localStorage`.
- Crear resultado compartible.
- Agregar pagina de explicacion y reglas.
- Probar cambio de fecha y restauracion de estado.

**Salida:** primer juego completo y desplegable.

### Fase 3 - Ampliacion Editorial

Duracion estimada: 3 a 5 dias.

- Ampliar el catalogo hasta 100 o 150 perfiles.
- Revisar cobertura por pais y competicion.
- Crear desafios diarios anticipados.
- Agregar herramientas de validacion editorial.
- Documentar proceso de correccion de datos.

**Salida:** contenido suficiente para el lanzamiento.

### Fase 4 - Grid 3x3

Duracion estimada: 4 a 6 dias.

- Modelar condiciones y respuestas validas.
- Crear generador y validador de grids.
- Implementar busqueda y seleccion por casilla.
- Evitar selecciones repetidas.
- Registrar elecciones anonimas.
- Calcular rareza.
- Crear resultado compartible.

**Salida:** segundo juego diario.

### Fase 5 - Draft de Cinco

Duracion estimada: 5 a 7 dias.

- Modelar rondas y condiciones.
- Generar candidatos validos.
- Implementar seleccion y bloqueo de repetidos.
- Definir formula de puntuacion transparente.
- Crear pantalla final del equipo.
- Crear resultado compartible.
- Evaluar modo libre sin comprometer el lanzamiento.

**Salida:** tercer juego diario.

### Fase 6 - Lanzamiento

Duracion estimada: 3 a 5 dias.

- Crear landing de juegos.
- Unificar navegacion entre modos.
- Completar SEO y metadatos sociales.
- Revisar estados de carga, vacios y errores.
- Revisar accesibilidad por teclado.
- Probar en moviles reales.
- Incorporar analitica anonima.
- Configurar monitoreo de errores.
- Publicar terminos, privacidad y creditos.
- Configurar backups de PostgreSQL.

**Salida:** MVP publico.

## 12. Backlog Priorizado

| ID | Tarea | Prioridad | Estado |
|---|---|---|---|
| G0.1 | Cerrar reglas de Freestyler del dia | Alta | Completado |
| G0.2 | Confirmar catalogo geografico y competitivo | Alta | Completado |
| G0.3 | Definir politica de imagenes | Alta | Completado |
| G0.4 | Crear wireframes | Alta | Completado |
| G1.1 | Agregar PostgreSQL y Prisma | Alta | Completado |
| G1.2 | Crear esquema inicial | Alta | Completado |
| G1.3 | Crear migraciones y seed | Alta | Completado |
| G1.4 | Crear importador JSON/CSV | Alta | Pendiente |
| G1.5 | Cargar y verificar 30 perfiles | Alta | Completado |
| G1.6 | Crear API de busqueda del catalogo | Alta | Completado |
| G2.1 | Crear desafio diario determinista | Alta | Completado |
| G2.2 | Crear endpoint de intento seguro | Alta | Completado |
| G2.3 | Crear UI de busqueda e intentos | Alta | Completado |
| G2.4 | Persistir progreso local | Alta | Completado |
| G2.5 | Crear resultado compartible | Alta | Completado |
| G2.6 | Agregar pruebas del juego diario | Alta | Completado |
| G3.1 | Ampliar catalogo a 100-150 perfiles | Media | En progreso |
| G3.2 | Crear validacion editorial | Media | En progreso |
| G4.1 | Modelar condiciones del grid | Media | Pendiente |
| G4.2 | Crear generador y validador de grids | Media | Pendiente |
| G4.3 | Crear experiencia Grid 3x3 | Media | Pendiente |
| G4.4 | Calcular rareza de respuestas | Media | Pendiente |
| G5.1 | Modelar condiciones del draft | Media | Pendiente |
| G5.2 | Definir puntuacion del draft | Media | Pendiente |
| G5.3 | Crear experiencia Draft de cinco | Media | Pendiente |
| G6.1 | Crear landing de juegos | Media | Pendiente |
| G6.2 | Agregar analitica y monitoreo | Media | Pendiente |
| G6.3 | Completar revision responsive y accesible | Alta | Pendiente |
| G6.4 | Preparar terminos, privacidad y creditos | Alta | Pendiente |
| G6.5 | Configurar deploy y backups | Alta | Pendiente |

## 13. Criterios de Aceptacion

### Catalogo

- No existen aliases o slugs duplicados.
- Cada perfil publicado tiene pais y al menos una fuente.
- Los datos usados como pistas estan completos o marcados como desconocidos.
- La busqueda tolera mayusculas, minusculas y acentos.

### Desafio Diario

- La misma fecha produce el mismo desafio.
- El desafio cambia exactamente una vez por dia.
- La respuesta no se filtra al cliente.
- Una partida se puede restaurar despues de recargar la pagina.
- El resultado compartido no contiene spoilers.

### Grid

- Todas las casillas tienen respuestas validas.
- No se puede usar el mismo freestyler dos veces.
- La validacion se realiza en servidor.
- La rareza utiliza datos agregados reales.

### Draft

- Todos los candidatos cumplen la condicion mostrada.
- No se puede elegir dos veces al mismo freestyler.
- La puntuacion final se puede explicar con reglas visibles.
- El estado se conserva despues de recargar.

### Experiencia

- Los tres juegos funcionan en movil y escritorio.
- Se pueden completar usando teclado.
- Los estados de carga y error son visibles y recuperables.
- Las paginas principales tienen metadatos sociales y SEO.

## 14. Pruebas y Verificacion

Pruebas automatizadas prioritarias:

- Normalizacion de aliases.
- Seleccion diaria por fecha y zona horaria.
- Comparacion de atributos.
- Rechazo de intentos invalidos.
- Validacion de respuestas del grid.
- Deteccion de grids sin soluciones.
- Restricciones y puntuacion del draft.
- Serializacion y restauracion del progreso local.
- Garantia de que los contratos publicos no incluyen soluciones.

Verificacion antes de cada entrega:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 15. Metricas Iniciales

- Partidas iniciadas por juego.
- Porcentaje de partidas terminadas.
- Porcentaje de victorias.
- Intentos promedio en Freestyler del dia.
- Casillas promedio completadas en Grid.
- Resultados compartidos.
- Retencion al dia siguiente y a siete dias.
- Errores o reportes de datos por desafio.

No se almacenaran nombres, correos, IPs completas ni otros datos personales para
estas metricas en el MVP.

## 16. Riesgos y Mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Datos incompletos o contradictorios | Revision editorial y fuente por registro |
| Cambios en APIs externas | Base propia e importaciones controladas |
| Uso indebido de fotos o marcas | Assets autorizados, propios o neutros |
| Grid sin respuestas suficientes | Validacion automatica previa |
| Puntuaciones subjetivas o polemicas | Reglas publicas y basadas en hechos |
| Filtracion de respuestas | Validacion server-side y contratos revisados |
| Alcance excesivo | Completar Freestyler del dia antes de avanzar |
| Catalogo sesgado por pais o liga | Objetivos de cobertura y revision editorial |

## 17. Cronograma Orientativo

| Semana | Entrega |
|---|---|
| 1 | Definicion, PostgreSQL, esquema y catalogo de 30 perfiles |
| 2 | Freestyler del dia funcional |
| 3 | Catalogo ampliado y Grid 3x3 |
| 4 | Draft de cinco |
| 5 | Pulido, pruebas, contenido y lanzamiento |

El cronograma asume una persona trabajando de forma sostenida. La calidad y la
verificacion del catalogo pueden extender la duracion mas que el desarrollo.

## 18. Decisiones

### Cerradas para la primera vertical

- Ocho intentos para Freestyler del dia.
- Edad expresada mediante rangos.
- Cobertura inicial: Argentina, Espana, Mexico, Chile, Peru y Colombia.
- Competiciones iniciales: FMS y Red Bull Batalla.
- Sin fotografias: se utilizaran aliases y banderas.
- Cambio diario en `America/Argentina/Buenos_Aires`.

### Pendientes

- Nombre comercial y convivencia con la marca actual `Freestyle Arena`.
- Nivel de cobertura historica posterior al MVP.
- Tratamiento de competidores con doble nacionalidad.
- Formato exacto del resultado compartible.
- Formula de puntuacion del draft.
- Si el cambio diario se mantiene en horario argentino al internacionalizar.
- Proveedor de PostgreSQL, despliegue y monitoreo.

## 19. Primera Meta Ejecutable

La primera meta es entregar una vertical completa con:

- PostgreSQL y Prisma integrados.
- 30 freestylers verificados.
- Un desafio diario determinista.
- Busqueda por alias.
- Ocho intentos con pistas.
- Persistencia local.
- Resultado compartible.
- Pruebas de reglas, fecha y filtracion de respuesta.
- Funcionamiento correcto en movil y escritorio.

No se inicia el Grid 3x3 hasta que esta vertical pueda desplegarse y jugarse de
principio a fin.

## 20. Registro de Ejecucion

### 2026-07-27 - Primer bloque de catalogo

- Reglas iniciales de Freestyler del dia cerradas.
- Prisma 6 integrado en `apps/server`.
- Esquema y migracion inicial creados.
- Seed idempotente preparado con 30 aliases de seis paises.
- Fuentes oficiales de FMS y Red Bull registradas en el seed.
- Busqueda normalizada disponible en `GET /api/catalog/freestylers?q=`.
- Pruebas de normalizacion y parametros de busqueda agregadas.
- Prisma schema, TypeScript y build del servidor validados.

El puerto `5432` estaba ocupado por el contenedor ajeno
`opencut-classic-db-1`. Se configuro `freestyle-db` en `127.0.0.1:5433` sin
modificar el otro proyecto. La migracion se aplico y el seed cargo los 30
perfiles correctamente. La busqueda normalizada se valido contra PostgreSQL con
el alias `aczíno` y devolvio el registro de Aczino de Mexico.

### 2026-07-27 - Importacion de fuentes externas

- Importador oficial de FMS creado con paginacion y coincidencia normalizada.
- Importador secundario de Wiki Rap creado sobre la API MediaWiki.
- Los 30 perfiles iniciales se encontraron en Wiki Rap.
- 17 perfiles coincidieron con la API vigente de FMS.
- 27 perfiles quedaron con ano de nacimiento disponible.
- Se detectaron 118 candidatos de titulos para validacion posterior.
- El inicio de actividad de Fandom no se publica como debut competitivo.
- Las contradicciones y candidatos se almacenan en `data_review_issues`.
- Politica de fuentes y atribucion registrada en `DATA_SOURCES.md`.

### 2026-07-27 - Catalogo visual

- Listado completo habilitado en `GET /api/catalog/freestylers?limit=100`.
- Pagina responsive creada en `/catalogo`.
- Busqueda local por alias o nombre real.
- Filtros por pais.
- Cobertura de nacimiento, FMS, fuentes e incidencias visible por perfil.
- Atribucion de Wiki Rap incluida en la pagina.

### 2026-07-27 - Validacion competitiva

- Parser de Fandom corregido para respetar plantillas anidadas y malformadas.
- Candidatos de titulos reducidos de 118 entradas contaminadas a 72 candidatos.
- Registro canonico creado con corte editorial 2024/25.
- 79 titulos mayores de FMS y Red Bull guardados con fuente.
- 49 candidatos comunitarios confirmados automaticamente.
- 23 candidatos permanecen pendientes.
- Participacion FMS confirmada para los 30 perfiles historicos.
- Participacion internacional de Red Bull definida para los 30 perfiles.
- La medicion posterior del catalogo ampliado registra 250 perfiles publicados y
  134 elegibles para el juego diario.

### 2026-07-27 - Freestyler del dia

- Desafio diario estable por fecha en `America/Argentina/Buenos_Aires`.
- Respuesta materializada en PostgreSQL y oculta hasta terminar la partida.
- Sesion anonima persistida mediante identificador local y hash en servidor.
- Ocho intentos con rechazo de aliases repetidos.
- Pistas de pais geografico, ano de nacimiento, participaciones registradas,
  FMS, Red Bull Internacional y titulos.
- Estado restaurable al recargar la pagina.
- Resultado final compartible sin spoilers.
- Interfaz responsive disponible en `/juegos/freestyler`.
- Endpoints disponibles en `/api/games/freestyler/today` y
  `/api/games/freestyler/today/guesses`.

### 2026-07-27 - Estilos de freestyle

- Taxonomia editorial normalizada con Punchline, Metricas, Flow, Doble tempo,
  Respuesta, Ingenio, Puesta en escena y Libre.
- Dos estilos ordenados por perfil: dominante y secundario.
- Coincidencia exacta para el estilo dominante y parcial al compartir una
  etiqueta secundaria.
- Procedencia editorial separada de las fuentes competitivas objetivas.
- Estilos visibles en el catalogo, pero fuera de la primera version jugable hasta
  completar su validacion editorial.

### 2026-07-27 - Expansion del catalogo

- Estado editorial agregado: `CANDIDATE`, `PUBLISHED` y `REJECTED`.
- API publica y juego limitados a perfiles publicados.
- Categoria de Wiki Rap recorrida mediante paginacion MediaWiki.
- 258 perfiles descubiertos en total.
- 30 perfiles existentes reconocidos sin duplicarlos.
- 197 candidatos nuevos creados para los seis paises iniciales.
- 31 perfiles de otros paises conservados fuera del alcance inicial.
- Distribucion nueva: 39 AR, 34 ES, 20 MX, 23 CL, 29 PE y 52 CO.
- Los 227 perfiles fueron enriquecidos desde FMS y Wiki Rap.
- 76 candidatos tienen ano de nacimiento plausible.
- 19 candidatos tienen nacimiento y coincidencia oficial FMS, listos para
  revision editorial.
- Descubrimiento verificado como idempotente.

### 2026-07-27 - Evidencia DEM Battles

- Importador dedicado creado para la pagina historica de DEM Battles.
- DEM registrada como competicion underground separada.
- 28 perfiles chilenos analizados.
- 19 perfiles vinculados con evidencia de participacion DEM.
- Importacion verificada como idempotente: segunda ejecucion sin duplicados.
- Cola de candidatos con nacimiento y evidencia competitiva ampliada de 19 a
  26 perfiles.
- Resultados DEM excluidos de la metrica de titulos mayores.

### 2026-07-27 - Circuitos de plaza y El Quinto Escalon

- Importador DEM generalizado mediante configuraciones de circuitos de plaza.
- El Quinto Escalon registrado como competicion argentina independiente.
- 47 perfiles argentinos analizados y 20 vinculados con evidencia de
  participacion entre 2012 y 2017.
- Equivalencias historicas declaradas para `G Sony`/`Sony` y
  `Lucho SSJ`/`Lucho`, sin relajar la coincidencia general de aliases cortos.
- Segunda ejecucion verificada sin crear participaciones duplicadas.
- Reporte separado para evidencia DEM (19) y El Quinto Escalon (20).
- Cola de candidatos con nacimiento y evidencia competitiva ampliada de 26 a
  34 perfiles.
- Participaciones de plaza excluidas de la metrica de titulos mayores.

### 2026-07-27 - Primer lote editorial ampliado

- Acru, Duki, Ecko, Lit Killah, RepliK, Trueno, Acertijo y Metalinguistica
  contrastados con fuentes oficiales o periodisticas adicionales.
- Ocho candidatos promovidos; el catalogo publico aumento de 30 a 38 perfiles.
- Dos estilos editoriales asignados a cada perfil nuevo.
- Validador corregido para no marcar automaticamente a todo perfil publicado
  como participante FMS.
- Tres titulos mayores agregados: FMS Argentina 2019 y Red Bull Argentina 2019
  para Trueno, y Red Bull Chile 2020 para Acertijo.
- Nombre contaminado de Ecko corregido a `Ignacio Matias Spallatti`.
- Fechas exactas conflictivas de Ecko eliminadas, conservando solo el ano 1999.
- Nacimiento de Acru y Acertijo retirado hasta resolver fuentes insuficientes o
  contradictorias; ambos permanecen fuera del juego diario.
- La base ampliada contiene 250 perfiles publicados, 53 con dos estilos
  editoriales y 134 elegibles para el desafio diario.
- Segunda validacion idempotente: cero titulos nuevos y ningun perfil faltante.
