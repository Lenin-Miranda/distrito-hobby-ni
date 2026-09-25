# Application migrations

Prisma Migrate is the sole owner of the `app` schema's application tables.
There are no models or application SQL migrations yet. Do not add a placeholder
migration or copy Supabase-managed auth/storage tables here.

Use the validated root `pnpm db:migrate:dev -- --name <name>` workflow after adding
models with `@@schema("app")`. Commit the resulting migration directory and
`migration_lock.toml` when the first real migration exists. Local infrastructure
roles and grants are prepared separately by `scripts/local/core.mjs`.

## Working directory and prerequisites

Run the root commands from the repository root, not from this directory. Complete [local setup](../../../../docs/local-development.md) first and select the intended local profile. The schema belongs to [the API Prisma package](../schema.prisma).

## Review before applying

Check the generated SQL, commit the schema and migration together, and verify against the isolated test profile. Use `pnpm db:migrate:deploy` to apply already committed migrations through the local wrapper. Do not introduce reset commands into normal startup or copy infrastructure-owned tables into application migrations.

Return to the [project guide](../../../../README.md) for the full environment and quality-check sequence.
