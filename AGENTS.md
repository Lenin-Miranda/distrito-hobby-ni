# Distrito Hobby: instrucciones de desarrollo

Este repositorio es un monorepo pnpm + Turborepo. Lee README.md y docs/architecture.md antes de modificar responsabilidades entre aplicaciones.

- `apps/web` (`@distrito/web`): Next.js App Router, presentación y transporte HTTP. Lee su AGENTS.md para las convenciones de la versión instalada de Next.
- `apps/api` (`@distrito/api`): NestJS estándar e independiente; dueño futuro de negocio, persistencia, autorización y proveedores.
- `packages/contracts`: contratos HTTP Zod, compilados a ESM + declaraciones; compatible con navegador y Node. Sin Nest, React, Prisma, filesystem ni entorno privado.
- `packages/typescript-config`: opciones estrictas comunes; NodeNext para API/contratos, bundler/JSX para web.

Usa Node 24 y pnpm 12.6.0. Conserva un lockfile raíz. Dependencias internas con `workspace:*` y exports de paquete, nunca imports relativos entre aplicaciones. No importes Prisma ni Better Auth servidor desde web. `pnpm lint` verifica estos límites automáticamente.

Prisma y su cliente deben permanecer en la misma versión exacta 7.x, dentro de API. No hay esquema ni generación automática. Better Auth está instalado pero no inicializado. No implementar comercio, auth, pagos, puntos o proveedores hasta diseñarlos. La paleta futura aprobada es azul marino, dorado y crema; este refactor no cambia el diseño temporal.

No expongas variables privadas desde web. `src/config/server.ts` debe permanecer protegido por `server-only`. No uses `next.config.env` para publicar configuración interna. No registres cuerpos, credenciales, cookies ni datos de clientes.

Antes de entregar: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Ejecuta los comandos secuencialmente para evitar carreras en `.next`. E2E compila antes de iniciar procesos reales; no reemplaces la integración por mocks.

Conserva la página temporal y sus pruebas. Documenta decisiones nuevas y lo diferido. Trabaja en ramas, usa commits convencionales y PRs; no fusiones ni hagas push directo a main sin autorización. La visibilidad GitHub se verifica por API, no por `private: true`; no la cambies sin confirmación específica.
