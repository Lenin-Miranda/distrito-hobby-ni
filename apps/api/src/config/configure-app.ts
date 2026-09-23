import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import type { Request, Response } from "express";
import type { Environment } from "./environment.js";
import { HttpExceptionFilter } from "./http-exception.filter.js";

export async function configureApp(app: INestApplication): Promise<void> {
  const config = app.get(ConfigService<Environment, true>);
  const origins = config.get("WEB_ORIGINS", { infer: true });
  app.use(helmet());
  app.enableCors({
    origin: origins,
    credentials: false,
    methods: ["GET", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks(["SIGTERM", "SIGINT"]);
  await app.init();
  // Nest 12 scopes its not-found handler to the global prefix. This standalone
  // server also returns a safe JSON 404 for paths outside that prefix.
  app.use((_request: Request, response: Response) => {
    response.status(404).json({ statusCode: 404, message: "Not found" });
  });
}
