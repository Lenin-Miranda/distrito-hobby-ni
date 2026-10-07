# DH-005: CI y límites del monorepo

El pipeline existente tenía un fallo intermitente durante la recarga Docker:
pnpm creaba entradas `_tmp_*` que desaparecían mientras Turbo las observaba.
DH-005 fija el store de pnpm en desarrollo, añade una regresión ejecutada en
ambos contenedores y comprueba con casos negativos los límites del monorepo.

## Cambios

- Las etapas development de web/API usan `PNPM_CONFIG_STORE_DIR=/pnpm/store`.
  Turbo transmite esta opción a los procesos hijos. Se conserva la instalación
  congelada y la política de scripts permitidos.
- El smoke de desarrollo observa el workspace durante un build real forzado de
  contratos. Exige cero entradas temporales de pnpm antes de comprobar recarga
  de fuentes y reconstrucción de contratos en ambos consumidores.
- `pnpm test:boundaries` ejecuta el verificador de imports/dependencias sobre
  fixtures independientes: un caso permitido y diez casos que deben rechazarse.
  CI ejecuta esta suite después de lint.
- CI también se ejecuta al hacer push a `staging`. Mantiene `contents: read`,
  acciones fijadas por SHA, `--frozen-lockfile`, pruebas de producción reales,
  limpieza de procesos y reportes de fallos con retención de siete días.
- La API de Playwright escucha explícitamente en `127.0.0.1`.

La causa y la configuración Docker se explican en [Docker](../docker.md).
Los comandos habituales se documentan en [desarrollo](../development.md).

## Validación local del 6 de octubre de 2026

Con Node 24.21.0 y pnpm 12.6.0 pasaron, secuencialmente:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm test:boundaries
pnpm test:local
LOCAL_PROFILE=test pnpm test:integration:db
LOCAL_PROFILE=test pnpm docker:smoke
LOCAL_PROFILE=test pnpm docker:smoke:dev
```

Las suites incluyen 29 pruebas de contratos/API/web, 8 E2E desktop/móvil,
11 comprobaciones de límites y una prueba del wrapper local. La integración DB
valida permisos, readiness y persistencia con Supabase real. Los smokes validan
contenedores de producción y recarga de desarrollo, incluyendo un cambio
posterior exclusivamente en contratos. Las fuentes temporales se restauraron;
los comandos de limpieza conservan los volúmenes.

Los pasos que escriben `.next` se ejecutaron sin solaparse. En CI, el job
`verify` usa una única fase coordinada de build dentro de `test:e2e`; el job de
infraestructura tiene su propio checkout y workspace.

## Controles negativos

1. **Límites:** los fixtures introducen imports y dependencias prohibidos. Se
   comprueban tanto el código de salida 1 como el diagnóstico esperado del
   mismo verificador que ejecuta `pnpm lint`.
2. **Prueba fallida:** se añadió temporalmente una prueba Vitest en contratos con
   `expect(true).toBe(false)`. El comando raíz `pnpm test`, utilizado por CI,
   terminó con código 1. Se eliminó la prueba y el mismo comando volvió a 0.
   No se publica una prueba deliberadamente fallida.
3. **Regresión pnpm:** la nueva prueba ejecutada en la imagen previa a la
   corrección detectó seis directorios temporales y terminó con código 1.
   Con la corrección, ambas imágenes terminaron con código 0 y ninguna entrada
   temporal; la recarga funcional también pasó.

Ningún check fue desactivado y no se aumentaron reintentos para ocultar el
fallo. La solución no cambia dependencias ni lógica comercial. Los reportes de
GitHub Actions del PR complementan esta evidencia local y verifican el checkout
limpio de CI.
