# Fuentes de Datos

## Politica

El catalogo combina fuentes con distintos niveles de confianza. Los datos no se
publican solamente porque aparezcan en una pagina: se conserva su procedencia y
las contradicciones se registran para revision.

Orden de confianza:

1. Sitios oficiales de FMS y Red Bull Batalla.
2. Wikidata y fuentes periodisticas verificables.
3. Wiki Rap en Fandom.
4. Revision editorial para conflictos o campos sin respaldo.

No se copian biografias completas, frases ni imagenes de las fuentes. El
catalogo utiliza hechos puntuales como alias, fechas, participaciones y titulos.

## FMS

- API: <https://fms.tv/wp-json/wp/v2/mcs>
- Uso: perfiles, fechas, ligas, temporadas y redes sociales.
- Prioridad: fuente oficial.
- Limitacion: el endpoint actual no conserva todos los perfiles historicos y
  tambien contiene entradas de equipos.

## Wiki Rap / Fandom

- Categoria: <https://rap.fandom.com/es/wiki/Categor%C3%ADa:Freestylers>
- API MediaWiki: <https://rap.fandom.com/es/api.php>
- Licencia declarada: CC BY-SA, salvo indicacion diferente en cada contenido.
- Uso: nombre real, nacimiento, inicio de actividad, participaciones y candidatos
  de titulos.
- Prioridad: fuente comunitaria secundaria.

La atribucion debe mantenerse visible en cualquier pagina que publique datos
derivados de Wiki Rap. Las imagenes alojadas por Fandom no se importan porque
pueden tener licencias distintas a la del texto.

El campo `actividad` no se considera automaticamente un debut competitivo. Se
guarda como incidencia candidata hasta que otra fuente confirme su significado.
Los titulos extraidos de la ficha tambien permanecen como candidatos hasta ser
contrastados con una fuente oficial.

### DEM Battles

- Pagina: <https://rap.fandom.com/es/wiki/DEM_Battles>
- Alcance: historia, formatos, ediciones y podios del circuito chileno desde
  2016.
- Uso actual: evidencia de participacion en el circuito underground.
- Limitacion: sigue siendo contenido comunitario bajo CC BY-SA, no una fuente
  oficial de FMS o Red Bull.

DEM se registra como competicion independiente. Sus participaciones no se suman
a `majorTitles`, para no equiparar una fecha de plaza con un campeonato nacional
o internacional.

### El Quinto Escalon

- Pagina: <https://rap.fandom.com/es/wiki/El_Quinto_Escal%C3%B3n>
- Categoria de circuitos: <https://rap.fandom.com/es/wiki/Categor%C3%ADa:Torneos_de_Plaza>
- Alcance: historia y podios del circuito argentino entre 2012 y 2017.
- Uso actual: evidencia de participacion para perfiles argentinos ya presentes
  en el catalogo.
- Limitacion: las tablas son una fuente comunitaria y no sustituyen una
  verificacion editorial individual.

El Quinto Escalon se registra como competicion separada. Al igual que DEM, sus
participaciones no incrementan `majorTitles`. Las equivalencias `Sony`/`G Sony`
y `Lucho`/`Lucho SSJ`, y los aliases cortos aceptados, estan declarados de forma
explicita en el importador para evitar coincidencias genericas ambiguas.

## Registro Canonico

`apps/server/src/importers/verifiedCatalog.ts` contiene el corte historico
revisado que la aplicacion puede usar. Cada titulo se vincula a la fuente oficial
de su competicion y se compara con los candidatos comunitarios mediante
competicion, alcance y ano.

El registro no incorpora regionales ni resultados posteriores al corte
editorial 2024/25. Una coincidencia resuelve el candidato; una diferencia se
mantiene abierta en `data_review_issues`.

Las promociones posteriores pueden declarar fuentes especificas por perfil en
`verifiedCatalog.ts`. El validador conserva el valor real de participacion FMS
en vez de asumir que todo perfil publicado compitio en esa liga. Cuando dos
fuentes confiables discrepan sobre el nacimiento, el dato se elimina hasta poder
resolverlo; el perfil puede seguir publicado, pero queda fuera del juego diario.

El primer lote ampliado contrasta perfiles oficiales de Red Bull y FMS con
fuentes como Universidad de Chile, La Tercera, Infobae, El Pais, TN, LOS40 y
CMTV. Los enlaces exactos se guardan como `DataSource` y permanecen asociados a
cada perfil.

El segundo lote incorpora 15 perfiles que ya contaban con nacimiento y evidencia
competitiva en el flujo de descubrimiento. Su promocion queda fijada en el seed y
en el registro canonico para que una base nueva no dependa de ejecutar primero
los importadores externos.

## Clasificacion de Estilos

Los estilos no son hechos objetivos ni provienen de una API estructurada. Se
mantienen como una clasificacion editorial versionada en
`apps/server/src/importers/verifiedStyles.ts`.

Cada perfil recibe un estilo dominante y uno secundario dentro de una taxonomia
cerrada. Estas etiquetas sirven como mecanica de juego y pueden revisarse sin
alterar los datos historicos de competiciones o titulos.

## Comandos

```bash
pnpm --filter @freestyle/server catalog:discover
pnpm --filter @freestyle/server catalog:import
pnpm --filter @freestyle/server catalog:import:freestyle-stats
pnpm --filter @freestyle/server catalog:import:freestyle-stats:battles
pnpm --filter @freestyle/server catalog:promote
pnpm --filter @freestyle/server catalog:bootstrap
pnpm --filter @freestyle/server catalog:import:dem
pnpm --filter @freestyle/server catalog:import:plazas
pnpm --filter @freestyle/server catalog:validate
pnpm --filter @freestyle/server catalog:report
pnpm --filter @freestyle/server catalog:evaluate:fandom
pnpm --filter @freestyle/server catalog:review:candidates
```

`catalog:discover` recorre la categoria completa de Wiki Rap y crea perfiles con
estado `CANDIDATE` solo para paises soportados. No aparecen en la API publica ni
en el juego hasta pasar a `PUBLISHED`.

La deteccion de pais combina categorias de Wiki Rap y el campo `origen` del
infobox. El catalogo puede contener perfiles publicados que aun no sean elegibles
para `Freestyler del dia`; el juego exige nacimiento, estilos, fuentes y hechos
comparables, mientras que otros juegos pueden usar perfiles incompletos.

Freestyle Stats se usa como fuente secundaria para identidad, nacimiento y
evidencia de participaciones o titulos. Sus datos se conservan como candidatos
hasta contrastarlos con FMS, Red Bull u otra fuente primaria.

`catalog:import:freestyle-stats:battles` recorre el sitemap publico de forma
incremental y procesa 100 batallas nuevas por ejecucion. Puede ajustarse con
`FREESTYLE_STATS_BATTLE_LIMIT`; solo persiste enfrentamientos cuyos dos
competidores ya existan en el catalogo.

`catalog:import:freestyle-stats:battles:auto` automatiza varios bloques y
guarda cada URL ya analizada, incluso si no corresponde a un perfil local. Por
defecto ejecuta 10 bloques de 100 con una pausa de un segundo. Se configura con
`FREESTYLE_STATS_BATTLE_BATCHES`, `FREESTYLE_STATS_BATTLE_LIMIT` y
`FREESTYLE_STATS_BATTLE_DELAY_MS`.

`catalog:import` es idempotente: actualiza las fuentes y evita duplicar sus
relaciones. Tambien rechaza anos de nacimiento que impliquen menos de 12 anos o
sean anteriores a 1950. `catalog:report` muestra cobertura, candidatos e
incidencias abiertas.

`catalog:import:plazas` importa en una sola ejecucion la evidencia de DEM Battles
y El Quinto Escalon. `catalog:import:dem` se conserva para ejecutar solo DEM.
