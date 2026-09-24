# Desarrollo y pruebas

## Entornos por aplicación

Usa Node 24 (>=24.11.0) y pnpm 12.6.0. Ejecuta `pnpm install --frozen-lockfile` en la raíz. Todos los paquetes son privados para publicación y comparten el lockfile raíz; no ejecutes npm install dentro de las apps.

Copia `apps/web/.env.example` a `.env.local` en ese directorio, y lo mismo para API. Next carga sus archivos locales; Nest Config carga `.env.local` y `.env` desde `apps/api`, dando prioridad a las variables del proceso.

| Variable                   | Lectura                                     | Uso                                                                      |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL` | Web, incluida al compilar cliente           | Base HTTP pública, incluyendo `/api/v1`                                  |
| `API_INTERNAL_BASE_URL`    | Solo servidor Next, en cada request técnico | Base HTTP accesible desde el servidor                                    |
| `PORT`                     | API                                         | Entero 1–65535; local 4000; escucha `0.0.0.0`                            |
| `WEB_ORIGINS`              | API                                         | Orígenes exactos separados por comas, sin paths ni comodines             |
| `NODE_ENV`                 | Runtime                                     | development, test o production; en producción WEB_ORIGINS es obligatorio |

Los defaults locales son `http://localhost:4000/api/v1` y origen `http://localhost:3000`. Configura URLs explícitas en despliegues. Cambiar una variable pública requiere reconstruir web; cambiar la interna afecta al runtime del servidor. Nunca pongas credenciales en `NEXT_PUBLIC_*` ni `next.config.env`.

DATABASE_ENABLED=false permite arrancar sin DB; DATABASE_URL se requiere cuando es true. DIRECT_URL y SHADOW_DATABASE_URL son exclusivos de herramientas Prisma. Consulta [desarrollo con Supabase](local-development.md) para el entorno generado y roles. Los placeholders BETTER_AUTH_SECRET, CLOUDINARY_URL, RESEND_API_KEY y PAYMENT_PROVIDER están reservados, vacíos y sin uso. No son obligatorios para arrancar ni probar. No se envían a Turbo indiscriminadamente: cada tarea declara solo las variables que necesita.

## Flujo local

```sh
pnpm dev        # ambas aplicaciones, con contratos construidos primero
pnpm dev:web    # solo frontend y sus dependencias
pnpm dev:api    # solo backend y sus dependencias
```

Los tres comandos usan Turbo watch, con tareas persistentes e interrumpibles. Las fuentes de contratos se compilan a `dist` antes de iniciar consumidores; al modificarlas Turbo reconstruye y reinicia los consumidores. No uses aliases a archivos TypeScript de otro paquete como sustituto de ese build. Detén el comando con Ctrl+C antes de usar otro que ocupe los mismos puertos.

```sh
pnpm build:web
pnpm --filter @distrito/web start

pnpm build:api
NODE_ENV=production PORT=4000 WEB_ORIGINS=http://localhost:3000 pnpm --filter @distrito/api start
```

El arranque de producción API equivale a `node dist/main.js` desde apps/api. Solo necesita artefactos y dependencias de producción, incluyendo los contratos compilados; no requiere Nest CLI ni Prisma generate.

## Checks

Ejecuta desde la raíz, secuencialmente:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @distrito/web exec playwright install chromium
pnpm test:e2e
```

- Contratos: acepta la respuesta válida, rechaza variantes incompatibles y no propaga campos extra.
- Web: conserva React Testing Library/jsdom y prueba validación HTTP, errores y timeout del cliente fetch. Esas pruebas unitarias no sustituyen E2E.
- API: Vitest Node con SWC; valida entorno, metadata/DI, health, Helmet, CORS permitido/rechazado, preflight y errores sin datos privados. Supertest inicia la aplicación Nest real, sin mock de HealthService.
- Playwright: `scripts/e2e.mjs` ejecuta una fase de build con URLs de prueba coherentes antes de levantar procesos. API usa 4100; web 3100; una segunda web 3101 apunta internamente a 4199, que debe estar libre, para verificar indisponibilidad sin interferir con las pruebas paralelas.
- Cada proyecto de Playwright ejecuta las comprobaciones existentes y las nuevas: desktop y móvil de 360 px. Se verifica Next → HTTP → Nest, navegador → API con CORS, error seguro y continuidad de la página temporal.

No levantes manualmente servicios en 3100, 3101, 4100 o 4199 durante E2E. Playwright rechaza servidores preexistentes y cierra los que inicia con SIGTERM y timeout. No ejecutes `playwright test` directamente desde un checkout limpio: usa el comando raíz que prepara los builds. La configuración Playwright no construye por su cuenta.

CI usa los mismos checks, con `playwright install --with-deps chromium`. El paso `pnpm test:e2e` incluye el build de ambas apps; así no se repiten builds con otras URLs ni hay carreras en `.next`. Solo se suben reportes/traces de fallos, nunca archivos de entorno.

## Caché, cambios y convenciones

Turbo cachea contratos/API en `dist` y web en `.next`, excluyendo `.next/cache`. Los inputs mantienen `$TURBO_DEFAULT$` y añaden `.env*`; las URLs relevantes participan en la clave del build web. `typecheck` no se cachea porque Next genera tipos de rutas; E2E y servidores tampoco. No hay caché remota configurada.

Las únicas excepciones nuevas de lifecycle son SWC, que comprueba su binding nativo, y la revisión específica de las versiones estables de Nest declaradas en `minimumReleaseAgeExclude`; no se permite ejecutar cualquier script globalmente. Prisma client sigue con postinstall bloqueado: Turbo ejecuta generación explícita desde el esquema vacío. Supabase 2.117.0 se distribuye con binarios opcionales por plataforma y no requiere autorizar otro postinstall.

Los cambios a componentes shadcn se hacen desde apps/web: `pnpm exec shadcn add <component>`, tras aprobar diseño. Conserva la página temporal, usa TypeScript estricto, tests proporcionales y commits convencionales. No añadas paquetes shared/UI/database/auth sin responsabilidad y consumidor concretos.
