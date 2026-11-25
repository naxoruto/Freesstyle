# Índice del proyecto — Freestyle Arena

Este es el punto de entrada para personas y asistentes de IA. Leerlo antes de elegir tareas o tomar un plan antiguo como vigente.

## Orden de lectura

1. [README](README.md): qué contiene el proyecto y comandos principales.
2. [Cambios y prioridades](docs/producto/CAMBIOS.md): registro central de lo realizado, lo pendiente y lo propuesto.
3. [Brainstorming de estructura y perfil](docs/producto/brainstorming/00-estructura-y-perfil.md): conversación de producto actual; todavía no es una especificación aprobada.
4. [Entorno local](docs/ENTORNO_LOCAL.md): configuración, migraciones y pruebas.
5. [Recuperación de batallas](docs/RECUPERACION_BATALLAS.md): contrato técnico, verificaciones y límites.

## Estado y prioridad actual

Las batallas activas se reconstruyen pausadas al arrancar y requieren reanudación explícita del organizador. El núcleo de torneos también se recupera al arrancar; su operación web sigue en desarrollo. La entrega T10 verificó 251 pruebas del servidor, además de lint, tipos y compilaciones; esa evidencia corresponde a ese estado concreto.

La prioridad del usuario es ahora mejorar batalla individual, torneos y Rey de la pista, y diseñar un perfil con registro mediante Google o correo y foto. Primero se afinan y documentan las decisiones. No implementar las propuestas abiertas como si estuvieran aprobadas.

## Mapa del código

| Área | Dónde empezar |
|---|---|
| Web y rutas | [apps/web/src/app](apps/web/src/app/) |
| Componentes de sala y votación | [apps/web/src/components](apps/web/src/components/) |
| HTTP, sockets y arranque | [apps/server/src/index.ts](apps/server/src/index.ts) |
| Batallas y torneos | [apps/server/src/rooms](apps/server/src/rooms/) |
| Reglas de puntuación | [apps/server/src/scoring](apps/server/src/scoring/) |
| Contratos y permisos compartidos | [packages/shared/src](packages/shared/src/) |
| Base de datos y migraciones | [apps/server/prisma](apps/server/prisma/) |
| Catálogo, inventario e importadores | [apps/server/src/importers](apps/server/src/importers/) |
| Juego diario | [apps/server/src/games](apps/server/src/games/) |
| Comprobadores manuales reproducibles | [scripts](scripts/) |

Las pruebas están junto al código, en archivos `*.test.ts`. Las pruebas de integración necesitan PostgreSQL descartable; consultar la guía de entorno antes de ejecutarlas.

## Documentación por tema

| Tema | Referencia |
|---|---|
| Producto y cambios | [Registro central](docs/producto/CAMBIOS.md) |
| Ideas previas de experiencia y perfiles | [Brainstorming previo](docs/producto/brainstorming/README.md) |
| Diseño de juegos diarios | [Plan de juegos](docs/producto/GAMES_PLAN.md) — backlog especializado, no prioridad actual |
| Política de fuentes del catálogo | [Fuentes](docs/datos/DATA_SOURCES.md) |
| Plan de trabajo consolidado | [Plan de trabajo](docs/PLAN_DE_TRABAJO.md) — producto + técnica, jerarquizado con dependencias |
| Organización y limpieza | [Criterios de organización](docs/ORGANIZACION.md) |
| Planes y fotografías históricas | [Archivo](docs/archivo/) — consultar como antecedentes |

## Al actualizar el proyecto

- Actualizar el registro central cuando cambie el estado de una iniciativa.
- Mantener las decisiones de producto en su documento de brainstorming y pasar a especificación después de acordarlas.
- Los documentos de archivo conservan afirmaciones y cifras antiguas. Contrastar con el código y el contrato vigente.
- Las dependencias, cachés y respaldos locales no forman parte del mapa de código. No borrar secretos ni migraciones como si fueran residuos.
