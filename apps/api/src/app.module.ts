import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "./config/environment.js";
import { HealthModule } from "./modules/health/health.module.js";
import { DatabaseModule } from "./database/database.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
      ignoreEnvFile: process.env.NODE_ENV === "test",
      validate: validateEnvironment,
    }),
    HealthModule,
    DatabaseModule,
  ],
})
export class AppModule {}
