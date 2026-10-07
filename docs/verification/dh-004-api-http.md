# DH-004: verificación de Nest y contratos HTTP

Validación del 6 de octubre de 2026 sobre `c9320de`, con Node 24.21.0 y pnpm
12.6.0. La API independiente y su integración con Next ya fueron incorporadas
en el [PR #1](https://github.com/Lenin-Miranda/distrito-hobby-ni/pull/1).
Esta entrega registra la aceptación de sus contratos, pruebas y arranques de
producción.

## Criterios y evidencia

| Criterio                           | Evidencia verificada                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health con contrato validado       | `GET /api/v1/health` devuelve `{"status":"ok","service":"distrito-hobby-api"}`. El esquema Zod compartido valida la respuesta. Con DB deshabilitada, health sigue en 200 y readiness devuelve 503: health representa únicamente liveness. |
| Configuración y seguridad HTTP     | Las pruebas rechazan puertos, entorno y orígenes inválidos. Nest aplica Helmet, CORS con lista explícita y sin credenciales, y errores públicos sanitizados. SIGTERM termina el proceso compilado y libera su puerto.                     |
| Next consulta en runtime           | `/system-status` usa `connection()`, configuración `server-only`, timeout, `no-store` y validación Zod. El build pasa sin API viva. E2E comprueba la ruta contra Nest real y una segunda instancia Next cuyo endpoint interno está caído. |
| Producción y resolución de módulos | Contratos y API compilan a ESM con NodeNext; contratos exporta JS y declaraciones. Nest arranca desde `dist/main.js`. La integración usa DI real y verifica la llamada a `HealthService`; E2E inicia Next standalone y Nest compilados.   |

Fuentes de las pruebas:

- [Entorno API](../../apps/api/test/environment.test.ts): configuración válida/inválida y mensajes que no revelan valores privados.
- [Integración HTTP](../../apps/api/test/health.integration.test.ts): metadata/DI real, Helmet, CORS permitido/rechazado, preflight, errores 404/500 y separación health/readiness.
- [Contratos](../../packages/contracts/test/health.test.ts): aceptación y rechazo de respuestas HTTP.
- [Cliente HTTP web](../../apps/web/src/lib/api/health.test.ts): contrato, errores HTTP y timeout; estas unitarias complementan la integración real.
- [E2E](../../apps/web/tests/e2e/system-status.spec.ts): Next → HTTP → Nest, CORS en navegador y API no disponible, en desktop y móvil.

## Pruebas ejecutadas

Tras `pnpm install --frozen-lockfile` en un checkout sin `node_modules`, pasaron
secuencialmente:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm build:api
```

Resultado: 29 pruebas de contratos/API/web y 8 E2E aprobadas. No hubo procesos
escribiendo `.next` simultáneamente. E2E construye antes de iniciar los servidores
de producción y los detiene al terminar.

Además se inició `node dist/main.js` desde `apps/api`, con
`NODE_ENV=production`, `BIND_HOST=127.0.0.1`, `PORT=4157`,
`WEB_ORIGINS=http://localhost:3157` y `DATABASE_ENABLED=false`. Por HTTP real se
comprobó health 200, readiness 503, 404 sanitizado, `X-Content-Type-Options:
nosniff`, origen permitido, ausencia de credenciales CORS y ausencia de
`X-Powered-By`. Al enviar SIGTERM, el proceso terminó dentro de diez segundos y
el puerto dejó de aceptar conexiones; no fue necesario SIGKILL.

Para reproducir el arranque usa `pnpm build:api` y después, desde `apps/api`:

```sh
NODE_ENV=production BIND_HOST=127.0.0.1 PORT=4157 \
  WEB_ORIGINS=http://localhost:3157 DATABASE_ENABLED=false node dist/main.js
```

Comprueba `/api/v1/health` y `/api/v1/ready` desde otra terminal. Los arranques
Next con API disponible/caída y el cierre automático se reproducen con el
comando raíz `pnpm test:e2e`.

## Decisiones y alcance

La [arquitectura](../architecture.md) mantiene persistencia y autorización en
API. Next consume contratos públicos por HTTP, sin importar Prisma ni Better
Auth servidor. Los contratos no dependen de React, Nest ni entorno privado.
Auth, comercio, pagos y proveedores siguen pendientes de diseño. La fiabilidad
del pipeline y sus pruebas negativas se entregan por separado en DH-005.
