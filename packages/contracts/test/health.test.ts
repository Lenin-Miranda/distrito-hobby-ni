import { expect, test } from "vitest";
import { healthResponseSchema } from "../src/index.js";

test("accepts the liveness response and strips non-contract fields", () => {
  expect(
    healthResponseSchema.parse({
      status: "ok",
      service: "distrito-hobby-api",
      privateValue: "discard",
    }),
  ).toEqual({ status: "ok", service: "distrito-hobby-api" });
});

test.each([
  {},
  { status: "down", service: "distrito-hobby-api" },
  { status: "ok", service: "database" },
])("rejects an invalid health contract: %j", (response) => {
  expect(healthResponseSchema.safeParse(response).success).toBe(false);
});
