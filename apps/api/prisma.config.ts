import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "prisma/config";

// Same precedence as Nest: process > .env.local > .env. Generation needs no URL.
for (const name of [".env.local", ".env"]) {
  const file = new URL(name, import.meta.url);
  if (existsSync(file)) {
    for (const [key, value] of Object.entries(
      parseEnv(readFileSync(file, "utf8")),
    )) {
      process.env[key] ??= value;
    }
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(process.env.DIRECT_URL
    ? {
        datasource: {
          url: process.env.DIRECT_URL,
          shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
        },
      }
    : {}),
});
