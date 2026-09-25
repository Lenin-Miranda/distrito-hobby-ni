# Application migrations

Prisma Migrate is the sole owner of the `app` schema's application tables.
There are no models or application SQL migrations yet. Do not add a placeholder
migration or copy Supabase-managed auth/storage tables here.

Use the validated root `pnpm db:migrate:dev -- --name <name>` workflow after adding
models with `@@schema("app")`. Commit the resulting migration directory and
`migration_lock.toml` when the first real migration exists. Local infrastructure
roles and grants are prepared separately by `scripts/local/core.mjs`.
