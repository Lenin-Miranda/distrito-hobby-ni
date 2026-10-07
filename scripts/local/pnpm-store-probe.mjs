import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

// Run inside each development container: pnpm's default store discovery creates
// short-lived _tmp_* entries that can race Linux's recursive Turbo watcher.
const root = path.resolve(import.meta.dirname, "../..");
const temporaryPaths = new Set();
let watchError;
const watcher = watch(root, (_event, name) => {
  if (name?.toString().startsWith("_tmp_")) temporaryPaths.add(name.toString());
});
watcher.on("error", (error) => {
  watchError = error;
});

try {
  // Force a real child task: this also checks Turbo's strict environment
  // propagation, not just the configuration of the parent pnpm process.
  await promisify(execFile)(
    "pnpm",
    [
      "exec",
      "turbo",
      "run",
      "build",
      "--filter=@distrito/contracts",
      "--force",
    ],
    { cwd: root, timeout: 60_000, maxBuffer: 1_000_000 },
  );
  await setTimeout(100);
  assert.equal(watchError, undefined, "Workspace watcher failed during probe.");
  assert.equal(
    temporaryPaths.size,
    0,
    "pnpm created temporary store-discovery entries in the watched workspace.",
  );
  console.log("PASS: pnpm and Turbo child tasks avoid workspace store probes.");
} catch (error) {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "pnpm store probe command failed; child output withheld.",
  );
  process.exitCode = 1;
} finally {
  watcher.close();
}
