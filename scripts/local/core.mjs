import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { createServer } from "node:net";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "../..");
const requireApi = createRequire(path.join(root, "apps/api/package.json"));
export const { Client, escapeIdentifier, escapeLiteral } = requireApi("pg");
export const profile = process.env.LOCAL_PROFILE ?? "dev";
if (!["dev", "test", "ci"].includes(profile))
  throw new Error("LOCAL_PROFILE must be dev, test or ci");
export const id = `distrito-hobby-ni${profile === "dev" ? "" : `-${profile}`}`;
export const network = `${id}-local`;
export const ports =
  profile === "dev"
    ? { http: 54321, db: 54322, studio: 54323, web: 3000, api: 4000 }
    : { http: 55321, db: 55322, studio: 55323, web: 3300, api: 4400 };
export const local = path.join(root, ".local", profile);
export const workdir = profile === "dev" ? root : local;
export const dbName = `supabase_db_${id}`;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// No shell; sensitive output is captured and never attached to thrown errors.
export function run(
  command,
  args,
  { env = {}, cwd = root, visible = false, timeout = 600_000 } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: visible ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (data) => {
      if (output.length < 4_000_000) output += data;
    });
    child.stderr?.resume();
    const terminate = () => child.kill("SIGTERM");
    process.once("SIGINT", terminate);
    process.once("SIGTERM", terminate);
    let expired = false;
    let killTimer;
    const timer = timeout
      ? setTimeout(() => {
          expired = true;
          terminate();
          killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
        }, timeout)
      : undefined;
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      process.removeListener("SIGINT", terminate);
      process.removeListener("SIGTERM", terminate);
    };
    child.once("error", () => {
      cleanup();
      reject(
        new Error(
          `Cannot execute ${path.basename(command)}; check installation/permissions.`,
        ),
      );
    });
    child.once("close", (code) => {
      cleanup();
      if (code !== 0 || expired)
        reject(
          new Error(
            `${path.basename(command)} failed${expired ? " (timeout)" : ` (exit ${code})`}. Sensitive tool output withheld; see docs/local-development.md.`,
          ),
        );
      else resolve(output.trim());
    });
  });
}
let localDockerChecked;
async function requireLocalDocker() {
  localDockerChecked ??= (async () => {
    const context = await run("docker", ["context", "show"]);
    const endpoint =
      (!process.env.DOCKER_CONTEXT && process.env.DOCKER_HOST) ||
      (await run("docker", [
        "context",
        "inspect",
        context,
        "--format",
        "{{.Endpoints.docker.Host}}",
      ]));
    if (
      !/^(unix:|npipe:|tcp:\/\/(localhost|127\.0\.0\.1|\[::1\]):)/.test(
        endpoint,
      )
    )
      throw new Error(
        "Select a local Docker endpoint before local infrastructure operations; remote Docker contexts are not supported.",
      );
  })();
  await localDockerChecked;
}
export async function docker(...args) {
  await requireLocalDocker();
  return run("docker", args);
}
export const pnpm = (args, options) => run("pnpm", args, options);
export async function supabase(...args) {
  await requireLocalDocker();
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("SUPABASE_") && value)
      throw new Error(`Unset ${key} before using the isolated local CLI.`);
  }
  for (const name of [".env", ".env.local"]) {
    const file = path.join(workdir, "supabase", name);
    if (existsSync(file) && readFileSync(file, "utf8").trim())
      throw new Error(
        "Resolve Supabase dotenv overrides before local operations.",
      );
  }
  const config = readFileSync(
    path.join(workdir, "supabase/config.toml"),
    "utf8",
  );
  if (config.match(/^project_id\s*=\s*"([^"\n]+)"\s*$/m)?.[1] !== id)
    throw new Error(
      "Supabase project_id does not match the selected local profile.",
    );
  const binary = await run("which", ["docker"]);
  return pnpm(["exec", "supabase", ...args, "--workdir", workdir], {
    env: {
      PATH: `${path.join(root, "scripts/local/bin")}${path.delimiter}${process.env.PATH}`,
      DISTRITO_DOCKER_BINARY: binary,
      DISTRITO_DOCKER_NETWORK: network,
      DISTRITO_DOCKER_PROJECT: id,
    },
  });
}
export function ensureFiles() {
  mkdirSync(local, { recursive: true, mode: 0o700 });
  if (profile !== "dev") {
    mkdirSync(path.join(local, "supabase"), { recursive: true });
    const config = readFileSync(path.join(root, "supabase/config.toml"), "utf8")
      .replace('project_id = "distrito-hobby-ni"', `project_id = "${id}"`)
      .replaceAll("5432", "5532")
      .replaceAll("localhost:3000", "localhost:3300");
    const file = path.join(local, "supabase/config.toml");
    if (existsSync(file) && readFileSync(file, "utf8") !== config)
      throw new Error(
        "Test config changed; reconcile the ignored profile config before continuing.",
      );
    if (!existsSync(file)) writeFileSync(file, config);
  }
}
export function readEnvironment(directory, names = [".env.local", ".env"]) {
  const result = { ...process.env };
  for (const name of names) {
    const file = path.join(directory, name);
    if (existsSync(file))
      for (const [key, value] of Object.entries(
        parseEnv(readFileSync(file, "utf8")),
      ))
        result[key] ??= value;
  }
  return result;
}
export function secrets() {
  ensureFiles();
  const file = path.join(local, "credentials.json");
  if (!existsSync(file))
    writeFileSync(
      file,
      JSON.stringify({
        runtime: randomBytes(24).toString("hex"),
        migrator: randomBytes(24).toString("hex"),
      }),
      { mode: 0o600, flag: "wx" },
    );
  const value = JSON.parse(readFileSync(file, "utf8"));
  if (![value.runtime, value.migrator].every((v) => /^[a-f0-9]{48}$/.test(v)))
    throw new Error("Invalid local credentials file.");
  return value;
}
export function environments() {
  const credentials = secrets();
  const url = (role, password, hostname, port, database = "postgres") =>
    `postgresql://${role}:${password}@${hostname}:${port}/${database}?schema=app`;
  const host = {
    DATABASE_ENABLED: "true",
    BIND_HOST: "127.0.0.1",
    DATABASE_URL: url(
      "distrito_runtime",
      credentials.runtime,
      "127.0.0.1",
      ports.db,
    ),
    DIRECT_URL: url(
      "distrito_migrator",
      credentials.migrator,
      "127.0.0.1",
      ports.db,
    ),
    SHADOW_DATABASE_URL: url(
      "distrito_migrator",
      credentials.migrator,
      "127.0.0.1",
      ports.db,
      "distrito_shadow",
    ),
    WEB_ORIGINS: `http://localhost:${ports.web}`,
    NEXT_PUBLIC_API_BASE_URL: `http://localhost:${ports.api}/api/v1`,
    API_INTERNAL_BASE_URL: `http://localhost:${ports.api}/api/v1`,
  };
  const compose = {
    LOCAL_NETWORK: network,
    LOCAL_PROJECT: `${id}-apps`,
    LOCAL_DATABASE_URL: url(
      "distrito_runtime",
      credentials.runtime,
      dbName,
      5432,
    ),
    WEB_PORT: String(ports.web),
    API_PORT: String(ports.api),
    NEXT_PUBLIC_API_BASE_URL: host.NEXT_PUBLIC_API_BASE_URL,
    WEB_ORIGINS: host.WEB_ORIGINS,
  };
  return { host, compose };
}
export function validateEnvironment() {
  const { host, compose } = environments();
  // Abort before infrastructure/data changes, never overwrite a user's environment.
  for (const directory of [
    root,
    path.join(root, "apps/api"),
    path.join(root, "apps/web"),
  ]) {
    const actual = readEnvironment(directory);
    for (const [key, value] of Object.entries(host)) {
      if (
        actual[key] !== undefined &&
        actual[key] !== "" &&
        actual[key] !== value
      )
        throw new Error(
          `Resolve conflicting ${key} in process/.env.local/.env (${path.relative(root, directory) || "root"}) before local operations. No values were printed.`,
        );
    }
  }
  const actual = readEnvironment(root, [".env.docker.local", ".env.docker"]);
  for (const [key, value] of Object.entries(compose))
    if (
      actual[key] !== undefined &&
      actual[key] !== "" &&
      actual[key] !== value
    )
      throw new Error(
        `Resolve conflicting Docker ${key} before local operations.`,
      );
  const file = path.join(local, "compose.env");
  const content =
    Object.entries(compose)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n";
  if (existsSync(file) && readFileSync(file, "utf8") !== content)
    throw new Error(
      "Generated compose.env differs; resolve it before continuing. It was not overwritten.",
    );
  if (!existsSync(file))
    writeFileSync(file, content, { mode: 0o600, flag: "wx" });
  return { host, compose };
}
export async function inspect(name) {
  try {
    return JSON.parse(await docker("container", "inspect", name))[0];
  } catch {
    return undefined;
  }
}
export async function freePorts(values) {
  // Docker Desktop can forward a published port without owning a host listen
  // socket. Inspect publications as well as testing native host listeners.
  const containers = (await docker("ps", "--format", "{{.ID}}"))
    .split("\n")
    .filter(Boolean);
  if (containers.length) {
    const output = await docker(
      "container",
      "inspect",
      ...containers,
      "--format",
      "{{json .NetworkSettings.Ports}}",
    );
    for (const line of output.split("\n"))
      for (const bindings of Object.values(JSON.parse(line) ?? {}))
        for (const binding of bindings ?? []) {
          if (values.includes(Number(binding.HostPort)))
            throw new Error(
              `Port ${binding.HostPort} is published by an existing Docker container. Other projects are never stopped; select an unused profile or resolve the conflict.`,
            );
        }
  }

  for (const port of values)
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", () =>
        reject(
          new Error(
            `Port ${port} is occupied. Stop your own conflicting mode or choose LOCAL_PROFILE=test; other projects are never stopped.`,
          ),
        ),
      );
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
}
export async function ensureNetwork() {
  let info;
  try {
    info = JSON.parse(await docker("network", "inspect", network))[0];
  } catch {
    /* create below */
  }
  if (!info) {
    await docker(
      "network",
      "create",
      "--label",
      `dev.distrito.project=${id}`,
      "--opt",
      "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
      network,
    );
    info = JSON.parse(await docker("network", "inspect", network))[0];
  }
  if (
    info.Labels?.["dev.distrito.project"] !== id ||
    info.Options?.["com.docker.network.bridge.host_binding_ipv4"] !==
      "127.0.0.1"
  )
    throw new Error(
      "Existing Docker network is not owned by this project or is not loopback-only.",
    );
}
export async function assertStack() {
  const names = (
    await docker(
      "ps",
      "-a",
      "--filter",
      `label=com.supabase.cli.project=${id}`,
      "--format",
      "{{.Names}}",
    )
  )
    .split("\n")
    .filter(Boolean);
  if (!names.includes(dbName))
    throw new Error(
      "Could not identify the project's Supabase PostgreSQL container.",
    );
  for (const name of names) {
    const info = await inspect(name);
    if (!info?.NetworkSettings.Networks[network])
      throw new Error("Supabase container is outside the expected network.");
    for (const bindings of Object.values(info.NetworkSettings.Ports ?? {})) {
      for (const binding of bindings ?? [])
        if (binding.HostIp !== "127.0.0.1")
          throw new Error(
            "Unsafe Supabase port binding detected; stop this project and check the network before continuing.",
          );
    }
    if (
      info.State.Status !== "running" ||
      (info.State.Health && info.State.Health.Status !== "healthy")
    )
      throw new Error("Supabase service is not healthy.");
  }
  const db = await inspect(dbName);
  if (
    !db.NetworkSettings.Ports["5432/tcp"]?.some(
      (p) => p.HostPort === String(ports.db),
    )
  )
    throw new Error("PostgreSQL host port does not match this profile.");
}
export async function startStack() {
  ensureFiles();
  validateEnvironment();
  await docker("info", "--format", "{{.ServerVersion}}");
  const db = await inspect(dbName);
  if (!db || db.State.Status !== "running")
    await freePorts([ports.http, ports.db, ports.studio]);
  await ensureNetwork();
  console.log(
    `Starting ${id}; first image downloads can take several minutes.`,
  );
  // Verified against 2.117.0 help. Studio, pg-meta, gateway, PostgREST and Auth remain.
  await supabase(
    "start",
    "--network-id",
    network,
    "--exclude",
    "realtime,storage-api,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor",
  );
  try {
    await retry(assertStack, 30);
  } catch (error) {
    await stopStack();
    throw error;
  }
}
export async function retry(action, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await action();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await sleep(1_000);
    }
  }
}
export async function connect(url) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 5_000,
    query_timeout: 6_000,
  });
  client.on("error", () => undefined);
  try {
    await client.connect();
    return client;
  } catch {
    await client.end().catch(() => undefined);
    throw new Error(
      "Local PostgreSQL connection failed; check this profile's running stack and credentials.",
    );
  }
}
export async function adminUrl() {
  await assertStack();
  const status = JSON.parse(await supabase("status", "--output", "json"));
  const value = status.DB_URL;
  const url = new URL(value);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== String(ports.db) ||
    url.pathname !== "/postgres" ||
    url.username !== "postgres"
  )
    throw new Error("CLI returned an unexpected database destination.");
  return value;
}
export async function bootstrap() {
  validateEnvironment();
  const client = await connect(await adminUrl());
  const credentials = secrets();
  try {
    await client.query("BEGIN");
    for (const [role, password] of [
      ["distrito_runtime", credentials.runtime],
      ["distrito_migrator", credentials.migrator],
    ]) {
      const found = await client.query(
        "SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = $1",
        [role],
      );
      if (found.rowCount && Object.values(found.rows[0]).some(Boolean))
        throw new Error(
          "Existing local role has unexpected elevated privileges.",
        );
      if (!found.rowCount)
        await client.query(
          `CREATE ROLE ${escapeIdentifier(role)} LOGIN PASSWORD ${escapeLiteral(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
        );
      await client.query(
        `ALTER ROLE ${escapeIdentifier(role)} SET search_path TO app`,
      );
    }
    const owner = await client.query(
      "SELECT pg_get_userbyid(nspowner) AS name FROM pg_namespace WHERE nspname = 'app'",
    );
    if (owner.rowCount && owner.rows[0].name !== "distrito_migrator")
      throw new Error("Existing app schema has another owner.");
    await client.query(`GRANT distrito_migrator TO postgres;
      CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION distrito_migrator;
      REVOKE ALL ON SCHEMA app FROM PUBLIC, anon, authenticated;
      GRANT USAGE ON SCHEMA app TO distrito_runtime;
      GRANT CONNECT ON DATABASE postgres TO distrito_runtime, distrito_migrator;
      ALTER DEFAULT PRIVILEGES FOR ROLE distrito_migrator IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO distrito_runtime;
      ALTER DEFAULT PRIVILEGES FOR ROLE distrito_migrator IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO distrito_runtime;
      ALTER DEFAULT PRIVILEGES FOR ROLE distrito_migrator IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
`);
    await client.query("COMMIT");
    const shadow = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ["distrito_shadow"],
    );
    if (!shadow.rowCount)
      await client.query(
        "CREATE DATABASE distrito_shadow OWNER distrito_migrator",
      );
    await client.query("REVOKE ALL ON DATABASE distrito_shadow FROM PUBLIC");
  } catch (error) {
    console.error(
      `Bootstrap PostgreSQL error code: ${error.code ?? "unknown"}`,
    );
    await client.query("ROLLBACK").catch(() => undefined);
    throw new Error(
      "Local role/schema bootstrap failed. Existing passwords were not rotated; inspect the local profile privately.",
    );
  } finally {
    await client.end();
  }
  const runtime = await connect(environments().host.DATABASE_URL);
  await runtime.end();
}
export async function migrate(mode, args = []) {
  const valid =
    mode === "deploy"
      ? args.length === 0
      : args.every(
          (arg, index) =>
            arg === "--create-only" ||
            (arg === "--name" &&
              /^[a-zA-Z0-9_-]+$/.test(args[index + 1] ?? "")) ||
            (index > 0 &&
              args[index - 1] === "--name" &&
              /^[a-zA-Z0-9_-]+$/.test(arg)),
        );
  if (!valid)
    throw new Error(
      "Migration wrapper accepts only --name NAME and --create-only; destination/config overrides are forbidden.",
    );
  const { host } = validateEnvironment();
  await assertStack();
  if (
    mode === "dev" &&
    !/^\s*(model|enum|view)\s+/m.test(
      readFileSync(path.join(root, "apps/api/prisma/schema.prisma"), "utf8"),
    )
  ) {
    console.log(
      "No application models: no migration to create. Use db:migrate:deploy to check pending history.",
    );
    return;
  }
  // Only these fixed, inspected local URLs reach migration tools. No remote override.
  await pnpm(
    ["--filter", "@distrito/api", "exec", "prisma", "migrate", mode, ...args],
    { env: host, visible: mode === "dev" },
  );
  const client = await connect(host.DIRECT_URL);
  try {
    if (
      (
        await client.query(
          "SELECT to_regclass('app._prisma_migrations') AS name",
        )
      ).rows[0].name
    )
      await client.query(
        "REVOKE ALL ON app._prisma_migrations FROM distrito_runtime",
      );
  } finally {
    await client.end();
  }
  console.log(`Prisma migrate ${mode} completed.`);
}
export async function setup() {
  await startStack();
  await bootstrap();
  await migrate("deploy");
  console.log(`Local DB ready. Studio: http://localhost:${ports.studio}`);
}
export async function compose(args, { dev = false, visible = false } = {}) {
  await requireLocalDocker();
  const { compose: env } = validateEnvironment();
  return run(
    "docker",
    [
      "compose",
      "--project-name",
      `${id}-apps`,
      "--env-file",
      path.join(local, "compose.env"),
      "-f",
      "compose.yaml",
      ...(dev ? ["-f", "compose.dev.yaml"] : []),
      ...args,
    ],
    {
      env: {
        ...env,
        LOCAL_DEPS_REV: createHash("sha256")
          .update(readFileSync(path.join(root, "pnpm-lock.yaml")))
          .update(readFileSync(path.join(root, "pnpm-workspace.yaml")))
          .update("node:24.21.0-bookworm-slim")
          .digest("hex")
          .slice(0, 12),
      },
      visible,
    },
  );
}
export async function stopStack() {
  ensureFiles();
  // --workdir is scoped; default stop backs up/preserves this project's data.
  await supabase("stop");
  console.log(`Stopped ${id}; database data preserved.`);
}
export async function appPorts() {
  for (const [service, port] of [
    ["web", ports.web],
    ["api", ports.api],
  ]) {
    const existing = await compose([
      "ps",
      "--status",
      "running",
      "-q",
      service,
    ]);
    if (!existing) await freePorts([port]);
  }
}
export async function http(url, expected = 200) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (response.status !== expected)
    throw new Error(
      `HTTP check failed: expected ${expected}, got ${response.status}`,
    );
  return response;
}
