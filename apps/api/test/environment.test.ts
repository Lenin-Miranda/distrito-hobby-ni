import { expect, test } from "vitest";
import { validateEnvironment } from "../src/config/environment.js";

test("starts locally without database credentials", () => {
  expect(validateEnvironment({})).toEqual({
    NODE_ENV: "development",
    PORT: 4000,
    WEB_ORIGINS: ["http://localhost:3000"],
  });
});

test("parses explicit origins and a provider port", () => {
  expect(
    validateEnvironment({
      PORT: "4100",
      WEB_ORIGINS: "https://store.example, http://localhost:3100",
    }),
  ).toMatchObject({
    PORT: 4100,
    WEB_ORIGINS: ["https://store.example", "http://localhost:3100"],
  });
});

test.each([
  { PORT: "" },
  { PORT: "wrong" },
  { PORT: "65536" },
  { WEB_ORIGINS: "*" },
  { WEB_ORIGINS: "https://*.example.com" },
  { WEB_ORIGINS: "https://store.example/path" },
  { WEB_ORIGINS: "https://user:secret@store.example" },
  { WEB_ORIGINS: "" },
  { NODE_ENV: "production" },
])("rejects invalid configuration %j", (input) => {
  expect(() => validateEnvironment(input)).toThrow("Invalid API configuration");
});

test("does not include invalid values in configuration errors", () => {
  expect(() => validateEnvironment({ PORT: "private-value" })).toThrow(
    "Invalid API configuration: PORT",
  );
});
