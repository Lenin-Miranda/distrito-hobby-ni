# Verificación de infraestructura local

Validación local: 24 de septiembre de 2026, macOS arm64, Node 24.21.0,
pnpm 12.6.0, Docker Engine 28.4.0 (linux/arm64), Compose 2.39.2.
Supabase CLI 2.117.0 y Prisma/client/adapter-pg 7.10.0.

| Comprobación ejecutada                                                                | Resultado                                                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                      | Correcta, conservando la política de lifecycle                                                                                                    |
| `pnpm db:generate`, builds de host y Docker sin credenciales DB                       | Cliente vacío ESM y artefactos correctos                                                                                                          |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`                                    | Correctos                                                                                                                                         |
| `pnpm test`                                                                           | 29 pruebas: contratos 4, API 20, web 5                                                                                                            |
| `pnpm test:local`                                                                     | Protección del binding Docker probada                                                                                                             |
| `pnpm test:e2e`                                                                       | 8 pruebas desktop/mobile; incluye web sin API                                                                                                     |
| `LOCAL_PROFILE=test pnpm test:integration:db`                                         | Prisma host, SQL parametrizado, escritura/lectura temporal, permisos, stop/start con persistencia, readiness 200→503→200 y liveness independiente |
| `LOCAL_PROFILE=test pnpm docker:smoke`                                                | API/DB en imagen final, SSR, navegador/CORS, assets, dos viewports, repeat up, sin bind mounts, usuario node, init, loopback                      |
| `LOCAL_PROFILE=test pnpm docker:smoke:dev`                                            | Recarga real web/API y cambio exclusivo de contratos en ambos consumidores; fuentes restauradas                                                   |
| `LOCAL_PROFILE=test pnpm db:migrate:dev -- --name infrastructure_check --create-only` | Estado sin modelos detectado; no se deja migración ficticia                                                                                       |
| Auditoría del runtime API                                                             | 391 enlaces internos comprobados; ningún Prisma/Supabase/Nest CLI, TypeScript, Vitest o Next en dependencias finales                              |
| Detección de conflictos                                                               | Perfil dev rechazó puertos publicados por otro proyecto; URL remota rechazada antes de escribir DB                                                |
| Escaneo de credenciales generadas                                                     | Ninguna en archivos candidatos a Git                                                                                                              |

Se utilizó una instancia separada `distrito-hobby-ni-test` porque otro proyecto
ocupaba 54321–54323. Sus contenedores permanecieron funcionando. No se ejecutó
reset, eliminación de volúmenes DB, cambio de visibilidad o despliegue externo.
La comprobación directa inicial de Prisma `migrate dev --create-only` produjo un
SQL vacío sin aplicarlo; se retiró y el wrapper ahora evita generarlo sin modelos.

La imagen Node tiene manifests arm64/amd64. Se probó Docker **linux/arm64**
localmente; el workflow añade un job independiente en Ubuntu amd64, cuyo
resultado se consulta en el PR. Windows nativo no está soportado por el wrapper
POSIX: usar WSL2. No se probaron proveedores de producción.

El CLI Prisma emite un aviso de detección de OpenSSL en las etapas Debian slim.
La generación comprobada y el runtime con adapter-pg funcionan; las migraciones
se ejecutan desde el host. No se incluye el motor/CLI de migración en el runtime.
