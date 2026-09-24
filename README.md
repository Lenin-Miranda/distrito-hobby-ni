# Distrito Hobby NI

Base de desarrollo para una futura tienda de Nicaragua. El mismo repositorio conserva su historial y su página temporal, ahora en un monorepo **pnpm + Turborepo**, con **Next.js** y una API **NestJS** desplegables por separado.

**Estado:** fase de arquitectura e infraestructura. Todavía no es una tienda en producción. Hay infraestructura PostgreSQL local y readiness real; todavía no hay catálogo, modelos comerciales, autenticación, pagos, checkout ni administración.

## Inicio rápido

Requisitos: Git, **Node >=24.11.0 <25** y **pnpm 12.6.0**. Se conservan `.nvmrc`, `.node-version`, `engineStrict` y el lockfile único.

```sh
nvm install
nvm use
npm install --global pnpm@12.6.0
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env.local
pnpm dev
```

Los ejemplos contienen únicamente URLs locales y placeholders vacíos. Los valores locales predeterminados permiten arrancar sin copiarlos. No hacen falta PostgreSQL ni credenciales.

- Web: <http://localhost:3000>
- Diagnóstico técnico: <http://localhost:3000/system-status>
- Liveness API: <http://localhost:4000/api/v1/health>

## Supabase y Docker local

Desde un clone instalado, sin copiar `.env`:

```sh
pnpm local:setup
pnpm dev:local       # Next/Nest host + Supabase Docker
# Alternativa: detener las apps host primero
pnpm docker:up      # Next/Nest Compose + la misma DB
pnpm docker:down    # conserva DB y volúmenes
pnpm supabase:stop  # conserva datos
```

Consulta [desarrollo local](docs/local-development.md) y [Docker](docs/docker.md)
para puertos, roles, codegen, migraciones, modo contenedorizado con recarga y
pruebas aisladas. `pnpm dev` conserva el modo sin DB. Si otros proyectos ocupan
54321–54323, los comandos abortan sin detenerlos; `LOCAL_PROFILE=test` selecciona
explícitamente otra instancia/puertos.

## Comandos desde la raíz

| Comando             | Resultado                                                             |
| ------------------- | --------------------------------------------------------------------- |
| `pnpm dev`          | Compila contratos y levanta web + API; observa cambios compartidos    |
| `pnpm dev:web`      | Contratos y servidor de desarrollo Next                               |
| `pnpm dev:api`      | Contratos y servidor de desarrollo Nest                               |
| `pnpm build`        | Compila contratos y ambas aplicaciones                                |
| `pnpm build:web`    | Compila dependencias compartidas y web                                |
| `pnpm build:api`    | Compila dependencias compartidas y API                                |
| `pnpm lint`         | Comprueba límites entre paquetes y lint por aplicación                |
| `pnpm typecheck`    | Tipos estrictos en los paquetes y tipos de rutas Next                 |
| `pnpm test`         | Vitest: contratos, React Testing Library, API con DI real y Supertest |
| `pnpm test:e2e`     | Build coordinado y Playwright contra procesos compilados reales       |
| `pnpm format`       | Prettier global                                                       |
| `pnpm format:check` | Comprueba formato global                                              |

Arranques de producción independientes, después de sus builds:

```sh
# Terminal web; variables del frontend ya configuradas
pnpm --filter @distrito/web start

# Terminal API; ejemplo local de entorno de producción
NODE_ENV=production PORT=4000 WEB_ORIGINS=http://localhost:3000 pnpm --filter @distrito/api start
```

La API sirve `dist/main.js` con Node; no usa Nest CLI, Vite ni TypeScript en producción. Para servir el JavaScript sin pnpm: `cd apps/api && node dist/main.js`.

## Estructura

```text
apps/
  web/                 Next existente: src, tests, App Router, Tailwind/shadcn
  api/                 Nest estándar: src, test, config, modules/health
packages/
  contracts/           Esquema Zod HTTP y tipo inferido; dist ESM + .d.ts
  typescript-config/   Base estricta y configuración NodeNext
scripts/
  check-boundaries.mjs Comprobación automatizada de imports y dependencias
  e2e.mjs              Build único previo a Playwright
.github/workflows/ci.yml
pnpm-workspace.yaml    Workspaces y política de scripts de instalación
turbo.json            Grafo de tareas, caché e inputs de entorno
docs/
  architecture.md      Responsabilidades, decisiones y alcance futuro
  development.md       Entornos, flujo local, pruebas y convenciones
  deployment.md        Despliegues independientes; no ejecutados
```

Cada app conserva su `package.json`, configuración de compilación, lint, pruebas y `.env.example`. No hay repositorios Git anidados ni lockfiles por aplicación.

## Stack y dependencias

Se conservan **Next 16.3.6, React 19.3.0, Prisma/client 7.10.0, Better Auth 1.7.5, TypeScript 5.9.3, pnpm 12.6.0** y las versiones del frontend existente: Tailwind, shadcn, Zod, React Hook Form, Zustand, Lucide y Motion.

Se añaden **NestJS 12.1.0**, Nest CLI 12.0.5 y Config 12.0.1 para el backend; **Turbo 2.11.3** para el grafo del monorepo; Helmet 8.3.0, reflect-metadata 0.2.2 y RxJS 7.8.2 para el arranque; Nest Testing, Supertest 7.3.0, SWC 1.16.2 y unplugin-swc 2.0.0 para probar decoradores e inyección real. `server-only` protege la configuración interna de web. Las versiones exactas están en los manifests y lockfile.

ESLint 9.39.5 permanece por compatibilidad con los plugins de Next; su aviso de deprecación es previo al refactor. No se fuerza ESLint 10. API usa reglas TypeScript propias, sin reglas de Next. shadcn CLI queda en devDependencies de web, disponible durante su build porque también aporta una hoja CSS.

Prisma pertenece exclusivamente a API: cliente sin modelos, adapter-pg 7.10.0 y PostgreSQL mediante Supabase CLI 2.117.0. Se añaden pg 8.23.0 y @types/pg 8.23.1. Better Auth permanece sin inicializar. Docker usa Node 24.21.0 Debian slim.

## Calidad

```sh
pnpm --filter @distrito/web exec playwright install chromium
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Ejecuta los checks secuencialmente: `typegen`, build y E2E no deben escribir `.next` en paralelo. E2E construye los artefactos una vez antes de iniciar servidores; en CI ese paso cubre también el build de producción.

La suite conserva desktop y móvil de 360 px; comprueba `/system-status` con Nest real, CORS en navegador y una segunda instancia web apuntando a un puerto sin API. La página temporal continúa funcionando en ese caso. Playwright cierra todos los procesos que inicia. No se cachean servidores ni E2E.

## Desarrollo y alcance

Usa ramas y pull requests, commits convencionales y `workspace:*` para paquetes internos. No importes código de una app desde otra. Los contratos públicos no son modelos Prisma. Conserva secretos fuera de Git; `private: true` solo impide publicar los paquetes en npm.

En la inspección de este refactor GitHub reportó el repositorio **público**, aunque la intención inicial era privado. La migración no cambia la visibilidad; cualquier cambio requiere confirmación específica.

Consulta [arquitectura](docs/architecture.md), [desarrollo](docs/development.md) y [despliegue](docs/deployment.md). Modelos comerciales, autenticación/cookies/CSRF, pagos, proveedores y diseño final quedan pendientes. La identidad futura aprobada es azul marino, dorado y crema; la página temporal no cambia de paleta.
