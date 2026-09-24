import {
  appPorts,
  assertStack,
  bootstrap,
  compose,
  environments,
  freePorts,
  http,
  id,
  migrate,
  pnpm,
  ports,
  retry,
  root,
  run,
  setup,
  startStack,
  stopStack,
  validateEnvironment,
} from "./core.mjs";
import path from "node:path";

const command = process.argv[2];
try {
  switch (command) {
    case "setup":
      await setup();
      break;
    case "start":
      await startStack();
      break;
    case "stop":
      await stopStack();
      break;
    case "status":
      await assertStack();
      console.log(
        `${id}: healthy, loopback only. DB port ${ports.db}; Studio http://localhost:${ports.studio}`,
      );
      break;
    case "dev": {
      await setup();
      await freePorts([ports.web, ports.api]);
      const { host } = validateEnvironment();
      // Separate PORT per app. Turbo watches contracts and restarts consumers.
      await run(
        process.execPath,
        [path.join(root, "scripts/local/host-dev.mjs")],
        { env: host, visible: true, timeout: 0 },
      );
      break;
    }
    case "migrate-dev":
    case "migrate-deploy":
      await bootstrap();
      await migrate(
        command === "migrate-dev" ? "dev" : "deploy",
        process.argv.slice(3).filter((arg) => arg !== "--"),
      );
      break;
    case "check": {
      await assertStack();
      const { host } = validateEnvironment();
      await pnpm(["build:api"]);
      await run(
        process.execPath,
        [path.join(root, "scripts/local/check.mjs")],
        { env: host, visible: true },
      );
      break;
    }
    case "build":
      validateEnvironment();
      await compose(["build"], { visible: true });
      break;
    case "up":
    case "docker-dev":
      await setup();
      await appPorts();
      await compose(
        [
          "up",
          "--build",
          "--detach",
          "--renew-anon-volumes",
          "--wait",
          "--wait-timeout",
          "180",
        ],
        { dev: command === "docker-dev", visible: true },
      );
      await retry(() => http(`http://localhost:${ports.api}/api/v1/ready`));
      console.log(
        `Web: http://localhost:${ports.web}; API: http://localhost:${ports.api}/api/v1`,
      );
      break;
    case "down":
      await compose(["down", "--remove-orphans"]);
      console.log("Apps stopped; all data volumes preserved.");
      break;
    case "logs":
      await compose(["logs", "--tail", "100"], { visible: true });
      break;
    case "integration":
      await (await import("./integration.mjs")).integration();
      break;
    case "smoke-dev":
      await (await import("./dev-smoke.mjs")).devSmoke();
      break;
    case "smoke":
      await (await import("./smoke.mjs")).smoke();
      break;
    default:
      throw new Error("Unknown local command.");
  }
} catch (error) {
  // Tool wrappers and our messages are safe. Never print raw pg/Prisma errors.
  const safe =
    error instanceof Error &&
    !error.message.includes("postgresql:") &&
    !error.message.includes("postgres:");
  console.error(
    safe
      ? error.message
      : "Local operation failed; connection details withheld.",
  );
  process.exitCode = 1;
}
