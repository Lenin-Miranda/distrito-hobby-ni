import { spawn } from "node:child_process";
import { root, ports } from "./core.mjs";
import path from "node:path";
const children = [
  ["@distrito/web", ports.web],
  ["@distrito/api", ports.api],
].map(([name, port]) =>
  spawn(
    process.execPath,
    [
      path.join(root, "node_modules/turbo/bin/turbo"),
      "watch",
      "dev",
      `--filter=${name}`,
    ],
    {
      cwd: root,
      env: Object.fromEntries(
        Object.entries({ ...process.env, PORT: String(port) }).filter(
          ([key]) =>
            name !== "@distrito/web" ||
            ![
              "DATABASE_ENABLED",
              "DATABASE_URL",
              "DIRECT_URL",
              "SHADOW_DATABASE_URL",
            ].includes(key),
        ),
      ),
      stdio: "inherit",
    },
  ),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 5_000);
  timer.unref();
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const child of children) {
  child.on("error", () => stop(1));
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
