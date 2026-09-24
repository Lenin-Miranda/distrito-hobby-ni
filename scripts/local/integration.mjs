import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import {
  connect,
  environments,
  escapeIdentifier,
  freePorts,
  http,
  pnpm,
  profile,
  retry,
  root,
  setup,
  startStack,
  stopStack,
} from "./core.mjs";

export async function integration() {
  if (profile === "dev")
    throw new Error(
      "Integration stop/start requires LOCAL_PROFILE=test or ci; development data is never used.",
    );
  await setup();
  await setup(); // idempotence
  await pnpm(["build:api"]);
  const { host } = environments();
  const port = 4460;
  await freePorts([port]);
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: path.join(root, "apps/api"),
    env: {
      ...process.env,
      ...host,
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}/api/v1`;
  const name = `infra_probe_${randomBytes(6).toString("hex")}`;
  const table = `app.${escapeIdentifier(name)}`;
  let migration;
  let pool;
  let prisma;
  let stopped = false;
  try {
    await retry(() => http(`${base}/ready`));
    assert.deepEqual(await (await http(`${base}/health`)).json(), {
      status: "ok",
      service: "distrito-hobby-api",
    });
    migration = await connect(host.DIRECT_URL);
    await migration.query(
      `CREATE TABLE ${table} (id integer PRIMARY KEY, value text NOT NULL)`,
    );
    const requireApi = createRequire(path.join(root, "apps/api/package.json"));
    const { Pool } = requireApi("pg");
    const { PrismaPg } = requireApi("@prisma/adapter-pg");
    const { PrismaClient } =
      await import("../../apps/api/dist/generated/prisma/client.js");
    pool = new Pool({
      connectionString: host.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 2000,
    });
    pool.on("error", () => undefined);
    prisma = new PrismaClient({
      adapter: new PrismaPg(pool, {
        schema: "app",
        disposeExternalPool: false,
      }),
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`CREATE TEMP TABLE local_transaction_probe (value text) ON COMMIT DROP`;
      const value = "parameterized ' runtime write";
      await tx.$executeRaw`INSERT INTO local_transaction_probe VALUES (${value})`;
      assert.deepEqual(
        await tx.$queryRaw`SELECT value FROM local_transaction_probe`,
        [{ value }],
      );
    });
    const runtime = await connect(host.DATABASE_URL);
    try {
      const perms = (
        await runtime.query(
          "SELECT has_schema_privilege(current_user, 'app', 'USAGE') AS usage, has_schema_privilege(current_user, 'app', 'CREATE') AS create, has_schema_privilege('anon', 'app', 'USAGE') AS anon, has_schema_privilege('authenticated', 'app', 'USAGE') AS authenticated",
        )
      ).rows[0];
      assert.deepEqual(perms, {
        usage: true,
        create: false,
        anon: false,
        authenticated: false,
      });
      const role = (
        await runtime.query(
          "SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname=current_user",
        )
      ).rows[0];
      assert.deepEqual(role, {
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolbypassrls: false,
      });
      await assert.rejects(runtime.query("SELECT * FROM auth.users LIMIT 1"), {
        code: "42501",
      });
      await assert.rejects(
        runtime.query("CREATE TABLE app.forbidden_probe (id int)"),
        { code: "42501" },
      );
      await runtime.query(`INSERT INTO ${table} VALUES ($1, $2)`, [
        1,
        "persists-after-stop",
      ]);
      assert.equal(
        (await runtime.query(`SELECT value FROM ${table} WHERE id=$1`, [1]))
          .rows[0].value,
        "persists-after-stop",
      );
    } finally {
      await runtime.end();
    }
    await migration.end();
    migration = undefined;
    await prisma.$disconnect();
    prisma = undefined;
    await pool.end();
    pool = undefined;
    await stopStack();
    stopped = true;
    const start = Date.now();
    await http(`${base}/ready`, 503);
    assert.ok(Date.now() - start < 5000, "readiness failure must be bounded");
    await http(`${base}/health`);
    await startStack();
    stopped = false;
    await retry(() => http(`${base}/ready`));
    migration = await connect(host.DIRECT_URL);
    assert.equal(
      (await migration.query(`SELECT value FROM ${table} WHERE id=$1`, [1]))
        .rows[0].value,
      "persists-after-stop",
    );
    console.log(
      "PASS: host Prisma, parameterized transaction, role/schema permissions, liveness/readiness outage+recovery, persistence and repeated setup.",
    );
  } catch (error) {
    throw new Error(
      `DB integration failed${error?.code ? ` (${error.code})` : ""}; connection details withheld. ${error?.name === "AssertionError" ? "Assertion failed." : ""}`,
    );
  } finally {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const kill = setTimeout(() => child.kill("SIGKILL"), 5000);
    if (child.exitCode === null) await exited;
    clearTimeout(kill);
    await prisma?.$disconnect();
    await pool?.end();
    if (stopped) await startStack();
    migration ??= await connect(host.DIRECT_URL);
    try {
      await migration.query(`DROP TABLE IF EXISTS ${table}`);
    } finally {
      await migration.end();
    }
  }
}
