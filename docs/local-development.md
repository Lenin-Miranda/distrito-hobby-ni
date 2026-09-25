# Desarrollo con Supabase local

Necesitas Node >=24.11 <25, pnpm 12.6.0 y Docker con Compose v2. Se recomienda
asignar 8 GB de RAM a Docker, al menos 4 CPU y espacio para varias imágenes y
cachés (10 GB o más). La descarga inicial requiere Internet y puede tardar varios
minutos. macOS/Linux y Windows mediante WSL2; los scripts del CLI usan `which` y
un ejecutable Node POSIX. No requieren login ni tokens Supabase Cloud.

## Desde un clone limpio

```sh
pnpm install --frozen-lockfile
pnpm local:setup
pnpm dev:local
```

No copies archivos `.env` para este flujo. `local:setup` valida destinos y puertos,
crea la red, inicia el CLI fijado, comprueba todos sus contenedores, prepara roles
locales y ejecuta `migrate deploy`. Es repetible y no borra datos. `dev:local`
hace el mismo setup y arranca Next/Nest en host con recarga y DB habilitada.
Ctrl+C detiene las apps, conservando Supabase. En este modo ambos servidores se enlazan a 127.0.0.1 (`BIND_HOST` de API y `--hostname` de Next). Los contenedores mantienen 0.0.0.0 internamente, con publicación loopback en Compose.

El modo básico anterior sigue disponible: `pnpm dev`, `pnpm test` y builds no
necesitan DB. `DATABASE_ENABLED` vale `false` por defecto; solo acepta strings
`true`/`false`. `/ready` responde 503 cuando está deshabilitada. Un `true` sin URL
PostgreSQL válida aborta el arranque con el nombre del campo, sin su valor.

## Direcciones y aislamiento

| Consumidor                                | Destino predeterminado                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| Navegador                                 | `http://localhost:4000/api/v1`                               |
| Next en host                              | `http://localhost:4000/api/v1`                               |
| Next en Compose                           | `http://api:4000/api/v1`                                     |
| API host / herramientas                   | PostgreSQL `127.0.0.1:54322`                                 |
| API Compose                               | `supabase_db_distrito-hobby-ni:5432`                         |
| Persona                                   | Web `http://localhost:3000`, Studio `http://localhost:54323` |
| Supabase HTTP (sin integración comercial) | `http://localhost:54321`                                     |

54321 es HTTP, nunca PostgreSQL. Los contenedores comparten una red explícita
`distrito-hobby-ni-local`; localhost dentro de API no apunta a la base. El nombre
DB se deriva de `project_id` y se valida por nombre, etiqueta de proyecto,
pertenencia a la red, puerto y salud usando Docker inspect. No usamos IPs ni IDs
efímeros, ni dependemos de `host.docker.internal`.

La red tiene `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`. Además,
`scripts/local/bin/docker` agrega el IP explícito a las publicaciones que el CLI
2.117.0 crea para **este** proyecto/red. Esto corrige Docker Desktop 28.4, que en
la prueba local ignoró la opción de red incluso fuera de Supabase. El wrapper
solo vive en el PATH del proceso CLI; no modifica Docker global. Rechaza nombres,
redes o formatos inesperados. Después se verifican los bindings efectivos:
ninguno puede ser 0.0.0.0 o IPv6 público. No ejecutes `supabase start` directamente;
usa los comandos raíz. El socket Docker nunca entra en web/API.

El stack reducido mantiene PostgreSQL 17, Studio, postgres-meta, Kong, PostgREST y
Auth para herramientas locales. Los flags `--exclude` se verificaron con la ayuda
del CLI. No se integran Auth, Storage, Realtime o Edge Functions en las apps;
Better Auth y Cloudinary conservan sus responsabilidades previstas.

## Entorno y credenciales

Precedencia: proceso > `.env.local` > `.env`, dentro de cada app. Nest y
`prisma.config.ts` la respetan. Los scripts revisan también el root y rechazan
valores no vacíos que contradigan el perfil administrado **antes de escribir en
la base**. Los valores vacíos de los ejemplos se rellenan en el proceso local.
No sobrescriben `.env` ni imprimen valores conflictivos. Resuelve el campo
indicado y vuelve a ejecutar; no se cambia automáticamente una URL remota.

Para Compose, proceso > `.env.docker.local` > `.env.docker`. Los valores
administrados deben coincidir con el perfil. `.env.docker.example` documenta los
nombres; no hace falta copiarlo. `LOCAL_DATABASE_URL` evita confundir el destino
Docker con `DATABASE_URL` de host. Compose recibe un archivo explícito
`.local/<perfil>/compose.env`; nunca consume accidentalmente otro `.env` raíz.

Las contraseñas aleatorias se guardan en `.local/<perfil>/credentials.json` y el
entorno Docker generado, con permisos 0600. Son ignorados por Git/Docker.
No borres ese directorio mientras conservas volúmenes: perderías las contraseñas
locales. No se rotan contraseñas existentes durante setup.

- `DATABASE_URL`: rol `distrito_runtime`, usado solo por Nest.
- `DIRECT_URL`: `distrito_migrator`, exclusivamente para Prisma/herramientas.
- `SHADOW_DATABASE_URL`: base separada `distrito_shadow`, propietario migrator;
  nunca apunta a postgres principal ni usa pooler.
- URL administrativa: leída en memoria del JSON del CLI, validada como loopback,
  puerto del perfil y base postgres; solo bootstrap. Nunca se guarda en web/API.

Las herramientas rechazan overrides `SUPABASE_*` y dotenv de `supabase/` que
puedan redirigir comandos a otro proyecto. No uses variables Cloud aquí.
`NEXT_PUBLIC_API_BASE_URL` se incorpora al build; `API_INTERNAL_BASE_URL` solo se
lee en el servidor. Next no recibe credenciales DB.

## Prisma y privilegios

```sh
pnpm db:generate                  # sin DB ni credenciales
pnpm db:check                     # Prisma SELECT parametrizado con rol runtime
pnpm db:migrate:deploy            # solo destino local inspeccionado
pnpm db:migrate:dev -- --name nombre
pnpm db:migrate:dev -- --name nombre --create-only
```

Prisma/client/adapter-pg están alineados en 7.10.0. `prisma-client` genera ESM en
`apps/api/src/generated/prisma`, ignorado; Turbo lo genera antes de compilar,
probar, lint o comprobar tipos de API. La generación no configura un fallback de
runtime ni conecta a PostgreSQL. La ayuda instalada confirma que el cliente sin
modelos está soportado (no usamos `--require-models`).

No hay modelos, seeds ni migraciones comerciales. `migrate dev` informa que no hay cambios de modelos y evita crear una migración vacía; al añadir el primer modelo ejecuta Prisma normalmente. `migrate deploy` valida el
estado vacío. Las futuras migraciones van solo en `apps/api/prisma/migrations`,
con `@@schema("app")`; Supabase no aplica migraciones/seed de aplicación.
`migrate dev` requiere terminal interactiva si necesita decisiones; revisa su
SQL y no aceptes borrar datos para resolver drift. El wrapper admite solo nombre
y `--create-only`, nunca un override de URL/config/schema. Ningún arranque de
contenedor ejecuta `migrate dev`.

Bootstrap crea roles no superuser, sin CREATEDB/CREATEROLE/BYPASSRLS, esquema app
propiedad de migrator y grants por defecto para sus futuras tablas/secuencias.
Runtime tiene USAGE y DML, no CREATE en app ni acceso a auth.users. Anon y
authenticated no tienen USAGE de app, y app no está en los esquemas de Data API.
No se desactiva RLS. El administrador local puede asumir migrator para crear el
esquema; ese permiso nunca se entrega a runtime. La tabla interna de historial
Prisma se revoca explícitamente a runtime después de migrar.

`PrismaService` comparte un Pool de máximo 5 conexiones, espera de conexión de
2 s, statement timeout de 2 s y query timeout de 2.5 s. Captura errores del pool
ocioso, devuelve readiness seguro y cierra cliente/pool al apagar. `/health`
conserva su contrato; `/ready` hace SELECT real, devuelve 200 `{"status":"ready"}`
o 503 mínimo. `/system-status` informa API/DB solo durante la petición.

## Parada, pruebas y diagnóstico

```sh
pnpm supabase:status              # estado seguro, sin claves
pnpm docker:down                  # solo aplicaciones
pnpm supabase:stop                # conserva datos de este proyecto
pnpm supabase:start
```

No hay reset, `--no-backup`, `down -v`, `--all` ni prune en estos comandos.
Los comandos normales nunca detienen otros proyectos ni liberan sus puertos.
Si 54321–54323 están ocupados, resuelve el conflicto tú o usa explícitamente el
perfil independiente de prueba:

```sh
LOCAL_PROFILE=test pnpm local:setup
LOCAL_PROFILE=test pnpm dev:local
LOCAL_PROFILE=test pnpm test:integration:db
LOCAL_PROFILE=test pnpm docker:smoke
LOCAL_PROFILE=test pnpm docker:smoke:dev
LOCAL_PROFILE=test pnpm docker:down
LOCAL_PROFILE=test pnpm supabase:stop
```

Test usa ID `distrito-hobby-ni-test`, Supabase 55321–55323, web 3300, API 4400 y
API temporal de integración 4460. CI usa ID `distrito-hobby-ni-ci` con esos puertos
en una máquina aislada. No ejecutes test y CI simultáneamente en el mismo host.
Las pruebas stop/start se niegan a usar el perfil dev. La tabla aleatoria de
prueba se elimina al terminar; también se prueba escritura parametrizada en una
tabla temporal de transacción. Los volúmenes se conservan incluso al limpiar.

`docker:smoke:dev` modifica temporalmente tres fuentes para verificar recarga de
web/API y luego solo contratos, restaura su contenido y baja Compose. No edites
esos archivos durante esa prueba. Dependencias/outputs del contenedor no se
montan sobre los del host.

Si un comando falla, el wrapper oculta la salida de herramientas que puede
contener secretos. Comprueba Docker Desktop, puertos, espacio y
`pnpm supabase:status`. Inspecciona logs del contenedor específico en una terminal
privada si necesitas más detalle; no publiques `supabase status -o json`,
`docker inspect` completo ni archivos `.local`. Un error de credenciales tras
borrar `.local` requiere recuperar el archivo original o decidir explícitamente
cómo reconstruir **solo** tu instancia; setup no resetea ni rota por su cuenta.

Referencias oficiales: [desarrollo local](https://supabase.com/docs/guides/local-development),
[CLI](https://supabase.com/docs/guides/local-development/cli/getting-started),
[start](https://supabase.com/docs/reference/cli/supabase-start),
[Prisma con Supabase](https://supabase.com/docs/guides/database/prisma),
[Prisma 7](https://www.prisma.io/docs/orm/v7).
