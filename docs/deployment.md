# Despliegues independientes (pendientes)

Esta migración no despliega ni cambia Vercel, Render, Railway, dominios, bases de datos de producción o configuración externa. Son instrucciones para una fase posterior.

## Web en Vercel

- Importar el mismo repositorio y elegir **Root Directory: `apps/web`**, framework Next.js.
- Habilitar acceso a fuentes fuera del root cuando corresponda. El build debe tener el lockfile raíz, `pnpm-workspace.yaml` y `packages/contracts` / `packages/typescript-config`; no subir apps/web como carpeta aislada.
- Usar Node 24 y pnpm fijado en el root. Instalación desde el monorepo: `cd ../.. && pnpm install --frozen-lockfile` si el comando empieza en apps/web.
- Build desde apps/web: `cd ../.. && pnpm build:web`. Turbo compila contratos antes de Next. Mantener la salida Next `.next` relativa al root de la aplicación; no cambiarla a una exportación estática, pues `/system-status` necesita servidor.
- Configurar `NEXT_PUBLIC_API_BASE_URL` con la URL pública HTTPS de API y `/api/v1`. Configurar `API_INTERNAL_BASE_URL` con una URL que Vercel pueda alcanzar; localhost de Vercel no es el backend externo.
- Mantener secretos de API fuera de las variables de web. Revisar explícitamente los orígenes de previews: no añadir comodines a CORS.

La documentación oficial describe la [configuración de monorepos y root directory](https://vercel.com/docs/monorepos). Verificar los ajustes de la cuenta al preparar el despliegue.

## API en Render, Railway o servicio Node

El contexto de build debe ser la raíz del monorepo, no una copia aislada de apps/api.

```sh
pnpm install --frozen-lockfile
pnpm build:api
```

Arranque en un entorno que conserva el workspace instalado:

```sh
cd apps/api
node dist/main.js
```

Configura `NODE_ENV=production`, el `PORT` asignado por el proveedor y `WEB_ORIGINS` con la lista exacta de URLs web. La API escucha `0.0.0.0` y respeta PORT. Healthcheck: `/api/v1/health`; no representa disponibilidad de base de datos ni proveedores.

Para una imagen mínima, usa etapas separadas: instala devDependencies para compilar, y conserva en runtime solo dependencias de producción, `apps/api/dist`, el paquete contracts con su `dist` y los enlaces/resolución de workspace correspondientes. No copies solo dist/main.js: Node necesita sus dependencias ESM. No ejecutes `nest start`, ts-node o Vite para servir producción. El CLI Prisma es de desarrollo y no interviene en el arranque actual.

## Ajustes manuales pendientes

1. Elegir hosting API, región, dominios HTTPS y URLs públicas/internas alcanzables.
2. Configurar roots, comandos, runtime y variables por entorno, con acceso a los paquetes del workspace.
3. Establecer orígenes CORS explícitos. Diseñar cookies, CSRF y Better Auth antes de añadir credenciales a CORS o sesiones.
4. Diseñar modelos comerciales y provisión PostgreSQL de producción. La infraestructura local ya existe, con esquema app vacío y roles aislados; no reutilizar sus contraseñas ni el CLI local en producción.
5. Revisar políticas operativas y la visibilidad del repositorio. GitHub lo reportó **público** durante esta migración; no se modificó. `private: true` en cada package.json impide publicación npm, no controla acceso a GitHub.

No hay pasarela elegida ni Stripe instalado. BAC es solo una opción futura por evaluar. No se integra Cloudinary, email, pagos ni WhatsApp Cloud API en esta fase.

Los Dockerfiles implementados se documentan en [Docker local](docker.md). Web standalone arranca con `node .next/standalone/apps/web/server.js` después de build, incluyendo assets preparados. API genera Prisma durante build, no al arrancar. Configurar DATABASE_ENABLED explícitamente en producción futura; `/api/v1/ready` requiere DB real.
