# DH-002 · Auditoría del repositorio y de la migración

Fecha: **6 de octubre de 2026**.
Revisión de código y pruebas: `c9320de91ef8bf51b534b2b614ce7c020d1854ec`.

## Resultado

La migración Next.js + NestJS existe y los checks básicos pasan en una copia
limpia. El repositorio sigue en fase de infraestructura: no hay modelos
comerciales, autenticación inicializada, catálogo, pedidos ni pagos.

La auditoría identifica dos asuntos que requieren seguimiento:

1. GitHub confirma que el repositorio es **público** y que `main` y `staging`
   reportan `protected: false`. Las reglas documentadas de trabajar mediante PR
   no equivalen a protecciones exigidas por GitHub.
2. La ejecución de CI del commit actual de `main` falló en el smoke de recarga
   de desarrollo de Docker. El job de calidad general, la integración DB y el
   smoke de producción pasaron. La infraestructura no se declara completamente
   validada por el resultado verde anterior del PR #2.

## Rama, historial y acceso

| Comprobación            | Evidencia                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Repositorio             | `Lenin-Miranda/distrito-hobby-ni`; remoto `origin` por HTTPS, sin credenciales incrustadas                                            |
| Referencias remotas     | Después de `git fetch origin`, `origin/main` y `origin/staging` apuntan a `c9320de`                                                   |
| Rama de auditoría       | `chore/dh-002-repository-audit`, creada desde `origin/staging`                                                                        |
| Diferencia inicial      | Sin diferencias respecto a `origin/main` y `origin/staging`                                                                           |
| Historial inspeccionado | 7 commits alcanzables y 147 blobs únicos, incluidas las ramas remotas obtenidas y el PR #3 abierto                                    |
| Visibilidad             | API de GitHub: `visibility: public`; los `private: true` de paquetes solo afectan npm                                                 |
| Protección de ramas     | API `branches/main` y `branches/staging`: `protected: false`                                                                          |
| Trabajo ya integrado    | PR #1: monorepo/API/contratos/CI; PR #2: Docker/Supabase local                                                                        |
| Trabajo abierto         | [PR #3](https://github.com/Lenin-Miranda/distrito-hobby-ni/pull/3): guías del README, dirigido a `main`; no se modifica ni se duplica |

Se verificó el acceso mediante API; los detalles de permisos de la cuenta quedan
en el registro de la tarea. Esta entrega añade únicamente el informe de auditoría
sobre una rama de trabajo, con destino de PR `staging`.

## Inventario técnico comprobado

| Área            | Estado real y evidencia en el repositorio                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workspace       | `apps/web`, `apps/api`, `packages/contracts` y `packages/typescript-config`; un único `pnpm-lock.yaml`; dependencias internas `workspace:*`                        |
| Compilación     | pnpm 12.6.0, Node >=24.11 <25 y Turbo 2.11.3; contratos ESM y declaraciones antes de sus consumidores; Prisma generado antes de API                                |
| Web             | Next 16.3.6, React 19.3.0, App Router, página temporal y `/system-status`; build y runtime standalone independientes                                               |
| API             | Nest 12.1.0 estándar; configuración validada, Helmet, CORS explícito, errores públicos sanitizados y cierre ordenado                                               |
| Contratos       | Esquemas HTTP Zod para health/readiness, sin modelos privados ni dependencia del entorno; exports de paquete                                                       |
| Persistencia    | Prisma/client/adapter-pg 7.10.0 exclusivamente en API; esquema sin modelos, cliente ESM y readiness SQL; infraestructura PostgreSQL local con Supabase CLI 2.117.0 |
| Autenticación   | Better Auth 1.7.5 instalado en API, sin instancia, sesiones ni adaptador implementados                                                                             |
| Calidad         | Prettier, lint con comprobación AST de límites, TypeScript estricto, Vitest, Supertest y Playwright con procesos reales                                            |
| Infraestructura | Dockerfiles de web/API, Compose, perfiles locales, scripts de integración/recarga y documentación; su ejecución DB/Docker no se repitió en esta auditoría          |

Se leyeron los AGENTS, README, arquitectura, desarrollo, documentación local y
Docker, manifests, configuración de Turbo/TypeScript, workflow y fuentes
relevantes. Página temporal, layout, CSS, prueba de página y E2E de inicio se
compararon byte a byte con sus rutas originales en `a115577`: son idénticos.

La separación de responsabilidades está implementada. `pnpm lint` confirmó
los límites entre paquetes. Web mantiene `server-only` para la configuración
interna y `next.config.ts` no publica variables mediante `env`. El entorno de
Compose de web no contiene credenciales DB. Los logs de aplicación revisados
registran eventos/códigos de fallo, sin cuerpos ni valores de configuración.

## Archivos sensibles e historial

Se revisaron nombres sensibles y contenido de los 147 blobs alcanzables mediante
patrones de claves privadas, tokens conocidos, JWT, credenciales en URLs y
asignaciones literales de secretos. El análisis solo produjo rutas, líneas,
tipos de coincidencia y clasificación; no se publicaron valores.

- No se detectaron secretos reales con los patrones utilizados. Las cinco
  coincidencias de URLs corresponden a datos sintéticos en tres versiones de
  `apps/api/test/environment.test.ts`: configuración inválida de CORS y una URL
  PostgreSQL de prueba, sin acceso a un proveedor real.
- Entre los 106 archivos de la revisión base y los nombres históricos no hay
  `.env` privados, `.local`, claves privadas ni `credentials.json` versionados.
- Los tres ejemplos de entorno mantienen vacíos sus campos sensibles.
- `git check-ignore --no-index` confirmó exclusión de `.env`, entornos locales
  de ambas apps, `.env.docker.local`, credenciales/entorno de `.local` y archivos
  `.pem`/`.key`. También se revisó `.dockerignore`.
- La copia de validación no contiene archivos locales de credenciales.

Este es un escaneo por patrones y revisión de configuración, no una garantía
de ausencia de cualquier secreto ni una auditoría completa de vulnerabilidades.
No cubre objetos inalcanzables, refs eliminadas, cuentas de terceros ni recursos
que no aparecen en las referencias obtenidas.

## Validación nueva en copia limpia

Versiones de validación: Node **24.21.0**, pnpm **12.6.0**. El binario Node se obtuvo
del sitio oficial y su SHA-256 se cotejó con `SHASUMS256.txt`. pnpm se instaló en
una carpeta temporal. La copia de prueba se creó con `git archive` del commit
auditado: comenzó sin dependencias, caché Turbo ni artefactos compilados.

La instalación utilizó un store vacío y `--frozen-lockfile`. Se comprobó que
lockfile, manifests y política pnpm no cambiaron. Los comandos siguientes se
ejecutaron secuencialmente; Turbo reutilizó únicamente resultados generados en
esta misma sesión cuando correspondía.

| Comando                                                        | Resultado observado                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile --store-dir <store-temporal>`  | Correcto; 943 paquetes añadidos desde cero; sin cambios al lockfile |
| `pnpm format:check`                                            | Correcto                                                            |
| `pnpm lint`                                                    | Correcto; límites entre paquetes verificados                        |
| `pnpm typecheck`                                               | Correcto, incluida generación de tipos de Next                      |
| `pnpm test`                                                    | 29 pruebas: 4 contratos, 20 API y 5 web                             |
| `pnpm test:local`                                              | 1 prueba del wrapper Docker, sin iniciar Docker                     |
| `pnpm build`                                                   | Contratos, cliente Prisma, API y web compilados                     |
| `pnpm --filter @distrito/web exec playwright install chromium` | Chromium instalado para la copia temporal                           |
| `pnpm test:e2e`                                                | 8 pruebas correctas, desktop y móvil de 360 px                      |

Las pruebas se ejecutaron con `CI=true`, `DATABASE_ENABLED=false` y
`BIND_HOST=127.0.0.1`, sin URLs ni credenciales privadas heredadas para las apps.
La configuración E2E fija asimismo el host de Next a loopback. E2E construyó
antes de arrancar Nest y dos instancias reales de Next; comprobó HTTP/CORS,
API no disponible y conservación de la página temporal. Al finalizar se
comprobó que 3100, 3101, 4100 y 4199 no tenían listeners.

Los únicos avisos observados en E2E fueron de precedencia entre `NO_COLOR` y
`FORCE_COLOR`; no afectaron al resultado.

No se ejecutaron otra vez integración DB, stop/start ni smoke Docker local:
DH-002 no cambia infraestructura. Los resultados remotos siguientes son
evidencia separada, no pruebas locales realizadas en esta sesión.

## CI remoto: fallo vigente y seguimiento

Se consultaron por API las ejecuciones y sus pasos, además del log del job de
infraestructura de `main`:

| Ejecución                                                                                          | Resultado relevante                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [PR #2 · 36067953912](https://github.com/Lenin-Miranda/distrito-hobby-ni/actions/runs/36067953912) | Verde en `ce5c873`; evidencia histórica de la entrega de infraestructura                                                                         |
| [main · 36093145314](https://github.com/Lenin-Miranda/distrito-hobby-ni/actions/runs/36093145314)  | Fallida en `c9320de`; `verify` pasó; DB real y smoke de producción pasaron; falló `Development source and contracts reload`; limpieza completada |
| [PR #3 · 36101381357](https://github.com/Lenin-Miranda/distrito-hobby-ni/actions/runs/36101381357) | `verify` pasó; el job de infraestructura falló en el mismo paso de recarga                                                                       |

El log de `main` muestra un error del watcher de Turbo en el servicio web:
`No such file or directory (os error 2)` sobre un directorio temporal
`/workspace/_tmp_…`, seguido por fallo de `@distrito/contracts:build` y salida 1
de Docker. Eso identifica el punto observado de fallo; **la causa raíz y su
corrección todavía requieren reproducir la recarga en Linux/CI**. Los avisos
OpenSSL previos no demuestran ser la causa de ese fallo.

Seguimiento propuesto para **DH-005**: reproducir con `LOCAL_PROFILE=ci` en
entorno aislado, revisar la interacción pnpm/Turbo/watchers y revalidar recarga
de fuentes y de contratos. No desactivar el smoke ni cerrar DH-005 basándose
solo en los checks locales o en el PR #2 anterior.

Otros seguimientos:

- Decidir explícitamente si se conserva la visibilidad pública. Cualquier cambio
  requiere autorización específica de Lenin.
- Acordar protecciones de `main`/`staging`, revisiones y checks obligatorios;
  esta auditoría no modifica políticas de GitHub.
- Si se quiere validar cada push a `staging`, revisar los triggers del workflow:
  actualmente cubren PR y push a `main`/`chore/**`, sin push a `staging`.
- Mantener el binding loopback explícito al ejecutar E2E: la API conserva
  `0.0.0.0` como valor predeterminado y la configuración E2E hereda `BIND_HOST`.

## Qué existe y qué sigue pendiente en el backlog

**DH-003 y DH-004:** implementación presente y comprobada con instalación,
compilación y pruebas actuales. Su cierre formal requiere vincular la evidencia
a sus propios criterios; DH-002 no modifica sus estados.

**DH-005:** workflow y comprobaciones presentes; permanece el fallo remoto de
recarga descrito. No se considera completamente resuelto por esta auditoría.

**DH-009 en adelante:** el esquema Prisma sigue sin modelos comerciales ni
seeds/migraciones de negocio. Faltan diseño aprobado, autenticación/admin,
catálogo, inventario comercial, compra, pagos, proveedores y diseño final.
Las reglas operativas DH-007 y los flujos DH-008 siguen siendo dependencias de
las siguientes implementaciones. Cuentas de cliente y puntos permanecen
post-MVP. Tampoco se verificó un despliegue productivo o staging externo.

## Criterios de DH-002

- [x] Revisados rama, historial, cambios locales, README, AGENTS, dependencias y pruebas.
- [x] Registrado qué existe y qué falta de la migración Next.js + NestJS.
- [x] Visibilidad y permisos consultados por API, con decisiones pendientes explícitas.
- [x] Trabajo en rama, sin pérdida de cambios, y revisión de archivos sensibles e historial.
- [x] Instalación con lockfile y checks ejecutados; fallos locales iniciales y fallo vigente de CI documentados.

La entrega de esta tarea es el inventario y la evidencia de auditoría. No implica
cerrar las tareas de implementación ni resolver los hallazgos que corresponden
a decisiones del propietario o a DH-005.
