# Herramientas locales

`start-local.cjs` es el lanzador de desarrollo para Windows, invocado desde `Iniciar Freestyle.cmd` en la raíz. Comprueba PostgreSQL y migraciones e inicia frontend y backend. `node scripts/start-local.cjs --check` comprueba los requisitos sin arrancar servicios ni contenedores. Preparación y uso en [Entorno local](../docs/ENTORNO_LOCAL.md).

## Comprobadores de recuperación

Ejecutar desde la raíz del repositorio. Requieren las dependencias del monorepo instaladas y PostgreSQL de pruebas migrado; no apuntar a datos que se quieran conservar.

| Archivo | Qué comprueba |
|---|---|
| `verify-battle-recovery.cjs` | Reinicios reales, sesiones, votos recuperados, reanudación y plazos vencidos en las cuatro modalidades. Exige `DATABASE_URL` hacia una base descartable llamada `freestyle_test`. |
| `lobby-restart-probe.cjs` | Recuperación de lobby, permisos e invitaciones y fallo de guardado de roles. Utiliza la base aislada de la auditoría en el puerto 55433 y detiene/reinicia únicamente `freestyle-audit-postgres`. |
| `phase-failure-probe.cjs` | Fallos de inicio/avance y guardado de padrón y voto de sala. Utiliza la misma base y contenedor aislados. Las variantes se seleccionan con `PROBE_START_FAILURE=1` o `PROBE_ROOM_SUCCESS=1`. |

Los dos comprobadores de auditoría se trasladaron desde `.turbo/` para conservarlos como código revisable. Las contraseñas incluidas corresponden exclusivamente al entorno local descartable de la auditoría.

Para las pruebas habituales, consultar [Entorno local](../docs/ENTORNO_LOCAL.md). El [contrato de recuperación](../docs/RECUPERACION_BATALLAS.md) describe los resultados y las limitaciones.
