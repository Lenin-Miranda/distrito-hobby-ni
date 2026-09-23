import { Controller, Get, Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Server } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/config/configure-app.js";
import { HealthService } from "../src/modules/health/health.service.js";

// Test-only controller exercises the same production exception filter.
@Controller("failure-probe")
class FailureProbeController {
  @Get()
  fail(): never {
    throw new Error("private-value-that-must-not-leak");
  }
}

let app: INestApplication;
let server: Server;

beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [FailureProbeController],
  }).compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await configureApp(app);
  server = app.getHttpServer() as Server;
});

afterAll(async () => {
  await app?.close();
});

test("injects the real HealthService via decorator metadata", async () => {
  const service = app.get(HealthService);
  const spy = vi.spyOn(service, "check");
  await request(server)
    .get("/api/v1/health")
    .expect(200)
    .expect({ status: "ok", service: "distrito-hobby-api" });
  expect(spy).toHaveBeenCalledOnce();
  spy.mockRestore();
});

test("allows the configured origin without enabling credentials", async () => {
  const response = await request(server)
    .get("/api/v1/health")
    .set("Origin", "http://localhost:3000")
    .expect(200);
  expect(response.headers["access-control-allow-origin"]).toBe(
    "http://localhost:3000",
  );
  expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
});

test("does not grant CORS access to an unlisted origin", async () => {
  const response = await request(server)
    .get("/api/v1/health")
    .set("Origin", "https://untrusted.example")
    .expect(200);
  expect(response.headers["access-control-allow-origin"]).toBeUndefined();
});

test("handles preflight only for an explicit allowed origin", async () => {
  const allowed = await request(server)
    .options("/api/v1/health")
    .set("Origin", "http://localhost:3000")
    .set("Access-Control-Request-Method", "GET")
    .expect(204);
  expect(allowed.headers["access-control-allow-origin"]).toBe(
    "http://localhost:3000",
  );
  const denied = await request(server)
    .options("/api/v1/health")
    .set("Origin", "https://untrusted.example")
    .set("Access-Control-Request-Method", "GET");
  expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
});

test("returns consistent public errors with no stack or private exception message", async () => {
  const log = vi
    .spyOn(Logger.prototype, "error")
    .mockImplementation(() => undefined);
  await request(server)
    .get("/api/v1/failure-probe")
    .expect(500)
    .expect({ statusCode: 500, message: "Internal server error" });
  expect(log).toHaveBeenCalledWith("HTTP failure (500)");
  log.mockRestore();
  await request(server)
    .get("/missing?private=value")
    .expect(404)
    .expect({ statusCode: 404, message: "Not found" });
});
