import { expect, test } from "vitest";
import { validateEnvironment } from "../src/config/environment.js";

test("starts locally without database credentials", () => {
  expect(validateEnvironment({})).toEqual({
    NODE_ENV: "development",
    DATABASE_ENABLED: false,
    PORT: 4000,
    BIND_HOST: "0.0.0.0",
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
  { BIND_HOST: "external.example" },
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

test("parses false explicitly and requires PostgreSQL credentials only when enabled", () => {
  expect(
    validateEnvironment({ DATABASE_ENABLED: "false" }).DATABASE_ENABLED,
  ).toBe(false);
  expect(() => validateEnvironment({ DATABASE_ENABLED: "yes" })).toThrow(
    "DATABASE_ENABLED",
  );
  expect(() => validateEnvironment({ DATABASE_ENABLED: "true" })).toThrow(
    "DATABASE_URL",
  );
  expect(() =>
    validateEnvironment({
      DATABASE_ENABLED: "true",
      DATABASE_URL: "https://private.example",
    }),
  ).toThrow("DATABASE_URL");
  expect(
    validateEnvironment({
      DATABASE_ENABLED: "true",
      DATABASE_URL: "postgresql://runtime:secret@127.0.0.1:54322/postgres",
    }).DATABASE_ENABLED,
  ).toBe(true);
});
