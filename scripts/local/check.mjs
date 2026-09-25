import "../../apps/api/node_modules/reflect-metadata/Reflect.js";
import { createRequire } from "node:module";
const requireApi = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const { ConfigService } = requireApi("@nestjs/config");
const { PrismaService } =
  await import("../../apps/api/dist/database/prisma.service.js");
const service = new PrismaService(
  new ConfigService({
    DATABASE_ENABLED: true,
    DATABASE_URL: process.env.DATABASE_URL,
  }),
);
try {
  if (!(await service.isReady())) throw new Error("Prisma SELECT 1 failed");
  console.log("Prisma SELECT 1 passed with runtime role.");
} finally {
  await service.onModuleDestroy();
}
