import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const env = {
  ...process.env,
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4100/api/v1",
  API_INTERNAL_BASE_URL: "http://127.0.0.1:4100/api/v1",
};

// One build phase, completed before Playwright starts any production process.
for (const [script, args, cwd] of [
  ["node_modules/turbo/bin/turbo", ["run", "build"], root],
  [
    "apps/web/node_modules/@playwright/test/cli.js",
    ["test"],
    path.join(root, "apps/web"),
  ],
]) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, script), ...args],
    { cwd, env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
