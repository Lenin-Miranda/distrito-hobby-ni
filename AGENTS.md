# Distrito Hobby: instrucciones de desarrollo

Este repositorio es un monorepo pnpm + Turborepo. Lee README.md y docs/architecture.md antes de modificar responsabilidades entre aplicaciones.

- `apps/web` (`@distrito/web`): Next.js App Router, presentación y transporte HTTP. Lee su AGENTS.md para las convenciones de la versión instalada de Next.
- `apps/api` (`@distrito/api`): NestJS estándar e independiente; dueño de persistencia local y futuro negocio, autorización y proveedores.
- `packages/contracts`: contratos HTTP Zod, compilados a ESM + declaraciones; compatible con navegador y Node. Sin Nest, React, Prisma, filesystem ni entorno privado.
- `packages/typescript-config`: opciones estrictas comunes; NodeNext para API/contratos, bundler/JSX para web.

Usa Node 24 y pnpm 12.6.0. Conserva un lockfile raíz. Dependencias internas con `workspace:*` y exports de paquete, nunca imports relativos entre aplicaciones. No importes Prisma ni Better Auth servidor desde web. `pnpm lint` verifica estos límites automáticamente.

Prisma y su cliente deben permanecer en la misma versión exacta 7.x, dentro de API. El esquema sin modelos vive en apps/api/prisma y Turbo genera el cliente ESM antes de API. adapter-pg debe estar alineado con Prisma/client. Supabase CLI es solo infraestructura local; Prisma Migrate es el único dueño de las futuras tablas app. Better Auth está instalado pero no inicializado. No implementar comercio, auth, pagos, puntos o proveedores hasta diseñarlos. La paleta futura aprobada es azul marino, dorado y crema; este refactor no cambia el diseño temporal.

No expongas variables privadas desde web. `src/config/server.ts` debe permanecer protegido por `server-only`. No uses `next.config.env` para publicar configuración interna. No registres cuerpos, credenciales, cookies ni datos de clientes.

Antes de entregar: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Ejecuta los comandos secuencialmente para evitar carreras en `.next`. E2E compila antes de iniciar procesos reales; no reemplaces la integración por mocks.

Conserva la página temporal y sus pruebas. Documenta decisiones nuevas y lo diferido. Trabaja en ramas, usa commits convencionales y PRs; no fusiones ni hagas push directo a main sin autorización. La visibilidad GitHub se verifica por API, no por `private: true`; no la cambies sin confirmación específica.

Infraestructura local: lee docs/local-development.md y docs/docker.md. No expongas puertos fuera de loopback; usa los scripts raíz con perfil explícito. No uses reset, stop --no-backup, down -v o --all. Pruebas DB/stop-start solo con LOCAL_PROFILE=test/ci. Conserva .local (credenciales ignoradas) junto a sus volúmenes. Next nunca recibe DATABASE_URL/DIRECT_URL. Ejecuta integración real y smoke de producción/desarrollo al cambiar esta infraestructura.
