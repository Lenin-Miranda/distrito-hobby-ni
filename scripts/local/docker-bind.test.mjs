import { test } from "node:test";
import assert from "node:assert/strict";
import { bindLoopback } from "./docker-bind.mjs";
test("binds only the selected project's published ports and preserves ordinary Docker commands", () => {
  const args = [
    "create",
    "--name",
    "supabase_db_example",
    "--network",
    "example-local",
    "-p",
    "55322:5432",
    "postgres",
  ];
  assert.equal(
    bindLoopback(args, "example-local", "example")[6],
    "127.0.0.1:55322:5432",
  );
  assert.deepEqual(
    bindLoopback(["inspect", "anything"], "example-local", "example"),
    ["inspect", "anything"],
  );
  assert.throws(() => bindLoopback(args, "other", "example"));
  assert.throws(() => bindLoopback(args, "example-local", "other"));
});
