# Organización del repositorio

## Estructura de referencia

```text
INDEX.md                  Entrada y mapa para personas e IA
AGENTS.md                 Orientación breve para agentes
README.md                 Presentación y comandos
apps/web/                 Aplicación web
apps/server/              API, sockets, Prisma y pruebas
packages/shared/          Tipos y reglas compartidas
scripts/                  Comprobadores reproducibles
docs/
  ENTORNO_LOCAL.md        Operación y verificación
  RECUPERACION_BATALLAS.md Contrato de recuperación
  producto/
    CAMBIOS.md            Registro central y prioridades
    GAMES_PLAN.md         Backlog de juegos diarios
    brainstorming/        Ideas y decisiones de producto
  datos/
    DATA_SOURCES.md       Política de fuentes
  archivo/                Planes y fotografías históricas
```

## Reubicaciones de esta limpieza

| Ubicación anterior | Ubicación actual |
|---|---|
| `PLAN.md`, `EXECUTION_PLAN.md`, `UPDATES.md` | `docs/archivo/` |
| `HANDOFF.md` | `docs/archivo/HANDOFF_DATOS_2026-07-28.md` |
| `DATA_SOURCES.md` | `docs/datos/DATA_SOURCES.md` |
| `GAMES_PLAN.md` | `docs/producto/GAMES_PLAN.md` |
| `brainstorming-producto/` | `docs/producto/brainstorming/` |
| `docs/superpowers/plans/2026-11-22-retomar-freestyle-arena.md` | `docs/archivo/RETOMAR_2026-11-22.md` |
| Comprobadores locales de lobby y fallos de fase en `.turbo/` | `scripts/` |

Los planes históricos conservan su texto. Una marca antigua de «completado» no sustituye las verificaciones del contrato vigente.

## Qué es código y qué es generado

| Elemento | Tratamiento |
|---|---|
| `node_modules/`, `.next/`, `dist/`, `*.tsbuildinfo` | Dependencias o salidas generadas; no son código de producto |
| `.turbo/cache/` | Caché regenerable de tareas |
| `.turbo/recovery-web-build/`, `.turbo/prisma-validation/` | Copias temporales creadas durante la auditoría; eliminadas tras retirar el enlace a dependencias y comprobar que los originales se conservaban |
| `.turbo/*.log` | Evidencia temporal de ejecuciones; no documentación vigente |
| `.turbo/snapshots/` | Copias anteriores del trabajo; conservar hasta revisar su cobertura en respaldos duraderos |
| `.local-backups/` | Respaldos locales transitorios; excluidos de git y descartables (el respaldo durable es el repositorio) |
| `.env` y `.env.local` | Configuración privada; conservar y no incluir en documentación |
| `prisma/migrations/` | Historial necesario de la base; no borrar aunque una migración ya se haya aplicado |
| Importadores y assets | No son residuos por su nombre; revisar usos y decisiones de producto antes de retirar |

No se reorganiza el código de la aplicación dentro de esta limpieza documental. Si un rediseño exige cambiar módulos, se prepara ese cambio como parte de su implementación, con verificación de imports y comportamiento.

## Mantenimiento

Usar `CAMBIOS.md` para el estado y las prioridades; documentos por tema para el detalle; `archivo/` para antecedentes. Actualizar enlaces al mover documentos y revisar que el índice permita encontrar cada área. Las ideas de brainstorming se convierten en especificación cuando se acuerdan, no cuando se escriben por primera vez.
