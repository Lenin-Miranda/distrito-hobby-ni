# DH-003: verificación del monorepo

Validación del 6 de octubre de 2026 sobre `c9320de`, con Node 24.21.0 y pnpm
12.6.0. La migración de Next a `apps/web` ya fue integrada en el
[PR #1](https://github.com/Lenin-Miranda/distrito-hobby-ni/pull/1).
Esta entrega documenta la aceptación de esa implementación y la prueba de
invalidación de caché entre paquetes.

## Criterios y evidencia

| Criterio                                | Evidencia verificada                                                                                                                                                                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conservar la aplicación Next            | `page.tsx`, `layout.tsx`, `globals.css`, `page.test.tsx` y `home.spec.ts` coinciden byte a byte con sus rutas originales en `a115577`. Se conservan los aliases, App Router y configuraciones propias de Next. El árbol original no contenía un directorio `public` que trasladar. |
| Workspaces y lockfile único             | `pnpm-workspace.yaml` incluye `apps/*` y `packages/*`; existe un solo `pnpm-lock.yaml` versionado. La instalación con lockfile congelado pasó desde un checkout sin `node_modules`.                                                                                                |
| Orden de compilación y desarrollo       | `^build` compila contratos antes de web/API; `build:web` también funciona desde la raíz. Las tareas `dev` son persistentes, interrumpibles y tienen `cache: false`. La prueba descrita abajo reconstruyó ambos consumidores al cambiar contratos.                                  |
| Versiones y exposición de configuración | Se conservan las versiones exactas del frontend, `workspace:*` y exports de paquete. La política `allowBuilds` es explícita. Solo `NEXT_PUBLIC_API_BASE_URL` es pública; la configuración interna permanece protegida por `server-only`.                                           |

Las decisiones y los comandos de uso están en el [README](../../README.md),
[arquitectura](../architecture.md) y [desarrollo](../development.md).

## Pruebas ejecutadas

Desde un checkout instalado con `pnpm install --frozen-lockfile`, se ejecutaron
secuencialmente, sin procesos escribiendo `.next` en paralelo:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm build:web
```

Todos terminaron con código 0. La suite contiene 29 pruebas de contratos,
API y web, y 8 E2E en Chromium desktop/móvil de 360 px. E2E inicia artefactos
compilados reales y conserva la página temporal con la API disponible y caída.

## Invalidación de caché comprobada

Se ejecutó `pnpm exec turbo run build --summarize`, se añadió temporalmente un
export constante a `packages/contracts/src/index.ts` y se repitió el mismo
comando. Los resúmenes de Turbo mostraron:

| Tarea                       | Hash inicial       | Hash con el cambio | Caché después del cambio |
| --------------------------- | ------------------ | ------------------ | ------------------------ |
| `@distrito/contracts#build` | `7cb093dbc30f3f32` | `609dafedba41dffd` | MISS                     |
| `@distrito/api#build`       | `48b05ac3195a41b5` | `ae900de00e37d2f6` | MISS                     |
| `@distrito/web#build`       | `b32786a9dd9156fd` | `b24db8e1e3f1bdba` | MISS                     |
| `@distrito/api#db:generate` | `fbdd443f5a133349` | `fbdd443f5a133349` | HIT                      |

La fuente original se restauró antes de los checks finales. Los hashes son
evidencia de esa ejecución, no valores que deban permanecer constantes.
Para repetir la prueba, compara `hash`, `cache.status` y `dependencies` de los
resúmenes en `.turbo/runs/` antes y después de un cambio temporal en contratos.
Ambos consumidores deben reconstruirse; la generación Prisma, cuyo esquema no
cambia, puede conservar su caché.

## Alcance pendiente

La aceptación específica de Nest y HTTP corresponde a DH-004. La corrección del
fallo intermitente del watcher en Docker y las pruebas negativas de CI
corresponden a DH-005. Esta validación no añade comercio ni modifica el diseño
temporal.
