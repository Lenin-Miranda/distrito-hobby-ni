import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly pool?: Pool;
  private readonly client?: PrismaClient;

  constructor(config: ConfigService) {
    if (!config.get<boolean>("DATABASE_ENABLED")) return;
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>("DATABASE_URL"),
      max: 5,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 10_000,
      statement_timeout: 2_000,
      query_timeout: 2_500,
      application_name: "distrito-api",
    });
    // Idle connections can fail during a DB restart. The next request reconnects.
    this.pool.on("error", () => undefined);
    this.client = new PrismaClient({
      adapter: new PrismaPg(this.pool, {
        schema: "app",
        disposeExternalPool: false,
      }),
      log: [],
      transactionOptions: { maxWait: 2_000, timeout: 3_000 },
    });
  }

  async isReady(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const value = 1;
      const rows = await this.client.$queryRaw<
        Array<{ value: number }>
      >`SELECT ${value}::int AS value`;
      return rows[0]?.value === value;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client?.$disconnect();
    } finally {
      await this.pool?.end();
    }
  }
}
