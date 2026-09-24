# Apps en Docker

El CLI oficial gestiona Supabase desde el host; Compose solo gestiona Next y
Nest. Ambos modos usan la misma DB local. Consulta primero
[desarrollo local](local-development.md) para requisitos y credenciales.

```sh
pnpm install --frozen-lockfile
pnpm local:setup
pnpm docker:build
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

`docker:build` no requiere una DB viva. `docker:up` valida/prepara Supabase y
migraciones antes de Compose; espera readiness de API y salud de web. Las apps
se publican solo en 127.0.0.1:3000/4000. Los healthchecks no sustituyen la espera
del stack externo. Las imágenes arrancan sin bind mounts ni node_modules host.

## Imágenes y artefactos

Se fija `node:24.21.0-bookworm-slim`, publicado para Linux arm64 y amd64. No se
fuerza una plataforma; Docker elige la nativa. Cada Dockerfile tiene etapas
base/dependencias, development, build y runtime, desde contexto raíz. La
instalación usa pnpm 12.6.0, frozen-lockfile y caché BuildKit. No se copian env,
artefactos, binarios ni dependencias del host.

Web configura output standalone con tracing root del monorepo. Su build prepara
`.next/standalone/apps/web/server.js`, copia `.next/static` y `public` si existe
a ese árbol, y arranca con Node. Conserva App Router y la ruta dinámica de
estado; el build no consulta API/DB. La imagen final contiene solo el standalone.

API compila contratos, cliente Prisma ESM y Nest. `pnpm deploy --prod --legacy`
produce `/out/api` autocontenido con pnpm 12.6.0. El empaquetador recorre las
dependencias runtime de ese artefacto, elimina peers opcionales de herramientas
de desarrollo y verifica enlaces internos. Esto evita incluir Prisma CLI,
TypeScript/Vitest y dependencias web que pnpm arrastra mediante peers opcionales
de Better Auth. No poda la instalación del workspace. Se sirve `node dist/main.js`,
sin Nest CLI, ts-node ni Supabase CLI.

Los runtimes usan usuario node (uid 1000), init de Compose, rootfs de solo lectura,
capabilities eliminadas, no-new-privileges y tmpfs para /tmp y caché Next. Nest
maneja SIGTERM/SIGINT y cierra el pool. No hay socket Docker, privilegios especiales
ni migraciones automáticas al iniciar la imagen.

## URLs de frontend

`NEXT_PUBLIC_API_BASE_URL` es el único build arg, público, normalmente
`http://localhost:4000/api/v1`. Cambiarlo requiere reconstruir web. Nunca uses
`http://api:4000` en el navegador. Compose establece únicamente en runtime
`API_INTERNAL_BASE_URL=http://api:4000/api/v1`; web no recibe claves DB.
Las credenciales runtime de API se inyectan al arrancar, nunca como build args.
No se incluyen contraseñas de bootstrap/migración en las imágenes finales.

## Desarrollo contenedorizado

Detén primero las apps en host o el Compose de producción:

```sh
pnpm docker:down
pnpm docker:dev
# Recarga automática al cambiar src de web, api o contratos.
pnpm docker:down
```

La extensión compose.dev usa las etapas development y `turbo watch`. Desactiva únicamente la reinstalación implícita de pnpm al ejecutar scripts (`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`): sus dependencias ya fueron instaladas con frozen-lockfile al construir la imagen. La política de scripts de instalación permanece intacta. Monta solo
las fuentes necesarias y el esquema Prisma; no monta todo el repositorio ni
node_modules host. Las dependencias tienen volúmenes de solo lectura separados por
servicio, con nombres derivados del hash del lockfile/política pnpm/imagen Node;
se reutilizan mientras ese hash coincide y se crean nuevos al cambiarlo; dist, cliente generado, .next y caché Turbo tienen
volúmenes propios. Al cambiar manifests, lockfile o configuración que no está
montada, repite `docker:dev` para reconstruir/recrear. Nunca ejecutes ambos modos
en los mismos puertos. El contenedor de desarrollo tiene filesystem escribible
para compilación; la restricción de solo lectura corresponde a runtime.

`docker:down` conserva los volúmenes y la red externa. `supabase:stop` detiene
solo el proyecto del perfil elegido, conservando DB. Ninguno ejecuta reset o
elimina datos. Las pruebas y CI usan perfiles separados; ver los comandos
`docker:smoke` y `docker:smoke:dev` en desarrollo local.

Esto no es un despliegue Supabase self-hosted de producción. No cambia Vercel,
la selección del proveedor Node, dominios, permisos ni servicios externos.

Referencias: [standalone Next](https://nextjs.org/docs/app/api-reference/config/next-config-js/output),
[variables Next](https://nextjs.org/docs/app/guides/environment-variables),
[pnpm Docker](https://pnpm.io/docker).
