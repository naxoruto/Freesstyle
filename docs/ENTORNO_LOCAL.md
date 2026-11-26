# Entorno local y pruebas

Esta guía utiliza PowerShell y una base PostgreSQL aislada. Los comandos de pruebas modifican datos de la base indicada en `DATABASE_URL`; nunca deben apuntar a una base con datos que se quieran conservar.

## Requisitos

- Node.js 22 (probado con 22.22.2), Corepack y pnpm 9.12.0, versión fijada en `package.json`.
- Docker con el motor Linux en ejecución y acceso al registro de imágenes cuando sea necesario.
- Dependencias del proyecto instaladas con `pnpm install --frozen-lockfile`.

```powershell
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
```

Revisar antes los archivos `.env` existentes y no sobrescribirlos. La URL de base de datos y los puertos del ejemplo se configuran en la sesión de PowerShell para este entorno aislado.

## Base independiente de pruebas

Este ejemplo utiliza el puerto local `55433`, distinto al `5433` de la configuración de desarrollo. Comprobar que está libre y que no existe un contenedor con este nombre antes de crearlo:

```powershell
docker ps -a --filter name=freestyle-audit-postgres
Test-NetConnection 127.0.0.1 -Port 55433
docker run -d --name freestyle-audit-postgres -e POSTGRES_USER=freestyle_test -e POSTGRES_PASSWORD=freestyle_test_local -e POSTGRES_DB=freestyle_test -p 127.0.0.1:55433:5432 postgres:16-alpine
docker exec freestyle-audit-postgres pg_isready -U freestyle_test -d freestyle_test
```

Si el contenedor ya existe y es el creado para este proyecto, arrancarlo con `docker start freestyle-audit-postgres` en lugar de crear otro. Esta base es solo local y sus credenciales son de ejemplo; no sirven para producción. Sus datos permanecen en el contenedor mientras este exista.

En Windows, `prisma:generate` puede fallar con `EPERM` si un servidor Node mantiene abierta la DLL del cliente. Detén únicamente los procesos de desarrollo de este proyecto y repite el comando. Para comprobar el esquema sin interrumpirlos, puedes generar un cliente temporal independiente desde la raíz:

```powershell
$probeDir = Join-Path (Get-Location) '.turbo/prisma-validation'
New-Item -ItemType Directory -Path $probeDir -Force | Out-Null
$schema = Get-Content 'apps/server/prisma/schema.prisma' -Raw
$schema = $schema.Replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"' + "`n  output = `"./client`"")
[System.IO.File]::WriteAllText((Join-Path $probeDir 'schema.prisma'), $schema, [System.Text.UTF8Encoding]::new($false))
$env:PRISMA_GENERATE_SKIP_AUTOINSTALL = '1'
.\node_modules\.bin\prisma.CMD generate --schema (Join-Path $probeDir 'schema.prisma')
```

Este cliente temporal sirve para verificar la generación; la aplicación sigue usando el cliente habitual y necesita que se regenere cuando la DLL quede libre.

El inventario se abre en `/inventario` con la clave configurada en `INVENTORY_ADMIN_TOKEN`. Sin una clave de al menos 32 caracteres, sus endpoints rechazan todas las solicitudes. Puedes generar una clave local con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y asignarla en tu archivo de entorno local, sin compartirla ni subirla a Git. La clave se conserva únicamente en la memoria de la página mientras está abierta.

En la raíz del repositorio, definir la URL, generar el cliente y aplicar las migraciones a esa base:

```powershell
$env:DATABASE_URL = 'postgresql://freestyle_test:freestyle_test_local@127.0.0.1:55433/freestyle_test'
pnpm --filter @freestyle/server prisma:generate
pnpm --filter @freestyle/server exec prisma migrate deploy
```

Opcionalmente, cargar datos iniciales **solo en una base preparada para ello**:

```powershell
pnpm --filter @freestyle/server db:seed
```

El seed modifica la base y carga un catálogo inicial pequeño; no restaura el catálogo curado descrito en el [handoff histórico](archivo/HANDOFF_DATOS_2026-07-28.md) ni garantiza suficientes datos para todos los desafíos diarios.

## Ejecutar y verificar

### Lanzador de Windows

Después de preparar las dependencias y la base, abrir **`Iniciar Freestyle.cmd`** en la raíz con doble clic. El lanzador usa las herramientas instaladas del proyecto directamente, comprueba la conexión y las migraciones, inicia backend y frontend, espera `/api/ready` y la página de inicio, y abre `http://localhost:3002` en el navegador predeterminado. La consola conserva los mensajes de los servicios.

Si la base local configurada en el puerto 5433 no responde, intenta `docker start freestyle-db`. Es necesario abrir Docker Desktop previamente. Si todavía no existe ese contenedor, preparar PostgreSQL de desarrollo desde la raíz con `docker compose up -d postgres`, utilizando la configuración local existente. El lanzador no crea bases, no ejecuta seeds ni aplica migraciones.

Si se detectan migraciones pendientes, respaldar y comprobar la restauración de los datos existentes antes de ejecutar `pnpm --filter @freestyle/server exec prisma migrate deploy` sobre la base configurada. Este comando aplica las migraciones guardadas en el repositorio; no usar `migrate reset` para arrancar la aplicación. Luego abrir nuevamente el lanzador.

Mantener la ventana abierta durante el uso y pulsar **Ctrl+C** para detener frontend y backend. PostgreSQL queda iniciado para conservar su disponibilidad. Si ya está corriendo `pnpm dev`, detenerlo antes de usar el lanzador para liberar los puertos. Un fallo de arranque detiene los servicios que inició el lanzador y conserva el mensaje visible.

Para comprobar solo dependencias, conexión y migraciones, sin iniciar servicios ni contenedores: `node scripts/start-local.cjs --check`. El lanzador carga el entorno del servidor en el mismo orden que la aplicación y conserva los archivos existentes. Para esta ejecución local, fija `SERVER_INTERNAL_URL` y `NEXT_PUBLIC_WS_URL` al backend iniciado, incluido su `WS_PORT`, para conectar tanto HTTP como las salas en tiempo real. El resto de la configuración web se carga desde Next.js como siempre.

Con `DATABASE_URL` configurada en la misma consola:

```powershell
pnpm dev
```

La web de desarrollo escucha en `http://localhost:3002` y el servidor en `http://localhost:3001`. Los valores de entorno locales pueden cambiar estas rutas. Para las verificaciones, usar otra consola con la misma `DATABASE_URL` de pruebas:

```powershell
$env:DATABASE_URL = 'postgresql://freestyle_test:freestyle_test_local@127.0.0.1:55433/freestyle_test'
pnpm lint
pnpm typecheck
pnpm --filter @freestyle/server test
pnpm build
```

Las pruebas de persistencia crean y eliminan registros con identificadores de prueba; la base debe estar aislada. `pnpm check` reúne las cuatro verificaciones mediante Turbo. La tarea de pruebas tiene la caché desactivada para que siempre se ejecute contra la base configurada; otras tareas pueden reutilizar resultados en caché.

Para detener el contenedor de pruebas sin eliminar sus datos: `docker stop freestyle-audit-postgres`. No se debe borrar el contenedor ni volúmenes existentes sin verificar antes qué datos contienen.

## Producción y respaldo

La configuración de producción exige `DB_PASSWORD`, `INVENTORY_ADMIN_TOKEN`, `SESSION_HASH_SALT` y `ALLOWED_ORIGINS`. Las dos claves deben tener al menos 32 caracteres; `ALLOWED_ORIGINS` contiene orígenes HTTPS exactos separados por comas, por ejemplo `https://arena.example`. Usar secretos independientes generados de forma aleatoria. Si la contraseña de PostgreSQL contiene caracteres especiales de URL, deben codificarse al construir `DATABASE_URL`.

El proxy incluido escucha por HTTP en el puerto 80: para un despliegue público hay que colocar delante un proxy que termine HTTPS, configurar el dominio y comprobar los encabezados y el origen permitido. No se ha configurado un certificado en este repositorio.

Antes de actualizar una base existente, hacer un respaldo y comprobar su restauración en otra base. Con los servicios de producción ya configurados, un ejemplo de respaldo desde el servidor PostgreSQL es:

```powershell
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U freestyle -d freestyle -Fc -f /tmp/freestyle-backup.dump
docker compose -f docker-compose.prod.yml cp postgres:/tmp/freestyle-backup.dump ./freestyle-backup.dump
```

Guardar el respaldo fuera del servidor y protegerlo como dato privado. Para ensayar la restauración, crear una **base nueva de pruebas**, copiar allí el archivo y ejecutar `pg_restore --no-owner --dbname=<base-de-prueba> <archivo>` desde un cliente con acceso. No restaurar encima de una base existente. Una vez comprobado el respaldo y levantado PostgreSQL, ejecutar las migraciones explícitamente antes de iniciar la aplicación:

```powershell
docker compose -f docker-compose.prod.yml run --rm server ./node_modules/.bin/prisma migrate deploy
```

`/api/health` indica que el proceso responde; `/api/ready` devuelve 503 si no puede consultar PostgreSQL. Las batallas activas se recuperan pausadas y requieren la reanudación del organizador. El núcleo de torneos activos también se restaura al arrancar; la operación web del torneo sigue en desarrollo. Consultar `RECUPERACION_BATALLAS.md` para el contrato y las limitaciones de batallas.

## Línea base de la auditoría

El 22 de noviembre de 2026 se aplicaron las 12 migraciones a PostgreSQL 16 aislado; la suite directa del servidor terminó con 151 pruebas aprobadas y se verificó la carga inicial de 53 perfiles. TypeScript, lint web y compilaciones de servidor y web se ejecutaron correctamente. Se comprobó además que la web, el servidor, el catálogo y el proxy respondían. Estos resultados describen ese estado concreto, no sustituyen las verificaciones después de futuros cambios.
