import "reflect-metadata";
import { ConsoleLogger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./config/configure-app.js";
import type { Environment } from "./config/environment.js";

const logger = new ConsoleLogger("API", {
  logLevels: ["log", "warn", "error"],
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.useLogger(logger);
  await configureApp(app);
  const config = app.get(ConfigService<Environment, true>);
  await app.listen(
    config.get("PORT", { infer: true }),
    config.get("BIND_HOST", { infer: true }),
  );
  logger.log("API ready");
}

bootstrap().catch(() => {
  logger.error(
    "API startup failed. Check configuration and port availability.",
    "Bootstrap",
  );
  process.exitCode = 1;
});
