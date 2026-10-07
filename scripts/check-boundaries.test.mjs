import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function fixture(
  t,
  {
    web = "",
    contracts = "",
    webDependencies = {},
    contractDependencies = { zod: "4.6.5" },
  } = {},
) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "distrito-boundaries-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "scripts"));
  copyFileSync(
    path.join(root, "scripts/check-boundaries.mjs"),
    path.join(directory, "scripts/check-boundaries.mjs"),
  );
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(directory, "node_modules"),
    "dir",
  );
  for (const [workspace, source, dependencies] of [
    ["apps/web", web, webDependencies],
    ["packages/contracts", contracts, contractDependencies],
  ]) {
    mkdirSync(path.join(directory, workspace, "src"), { recursive: true });
    writeFileSync(path.join(directory, workspace, "src/index.ts"), source);
    writeFileSync(
      path.join(directory, workspace, "package.json"),
      JSON.stringify({ dependencies }),
    );
  }
  return spawnSync(process.execPath, ["scripts/check-boundaries.mjs"], {
    cwd: directory,
    encoding: "utf8",
    timeout: 10_000,
  });
}

test("accepts package exports and environment-independent contracts", (t) => {
  const result = fixture(t, {
    web: 'import { healthResponseSchema } from "@distrito/contracts";',
    webDependencies: { "@distrito/contracts": "workspace:*" },
    contracts: 'import { z } from "zod"; export const status = z.string();',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

for (const [name, input, diagnostic] of [
  [
    "Prisma from web",
    { web: 'import { PrismaClient } from "@prisma/client";' },
    /forbidden import @prisma\/client/,
  ],
  [
    "server auth re-export from web",
    { web: 'export { betterAuth } from "better-auth";' },
    /forbidden import better-auth/,
  ],
  [
    "dynamic API import from web",
    { web: 'await import("@distrito/api");' },
    /forbidden import @distrito\/api/,
  ],
  [
    "relative import escaping web",
    { web: 'import "../../api/src/main.js";' },
    /forbidden import/,
  ],
  [
    "API type import from contracts",
    { contracts: 'type App = import("@distrito/api").AppModule;' },
    /forbidden import @distrito\/api/,
  ],
  [
    "Node import from contracts",
    { contracts: 'import { readFile } from "node:fs";' },
    /forbidden import node:fs/,
  ],
  [
    "private environment in contracts",
    { contracts: "export const url = process.env.DATABASE_URL;" },
    /environment-independent/,
  ],
  [
    "computed module loading",
    { web: 'const name = "@prisma/client"; await import(name);' },
    /nonliteral module loading/,
  ],
  [
    "Prisma runtime dependency in web",
    { webDependencies: { "@prisma/client": "7.10.0" } },
    /forbidden runtime dependency @prisma\/client/,
  ],
  [
    "React runtime dependency in contracts",
    { contractDependencies: { react: "19.3.0" } },
    /forbidden runtime dependency react/,
  ],
]) {
  test(`rejects ${name}`, (t) => {
    const result = fixture(t, input);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, diagnostic);
  });
}
