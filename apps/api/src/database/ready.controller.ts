import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";

@Controller("ready")
export class ReadyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    if (!(await this.prisma.isReady())) {
      throw new ServiceUnavailableException("Database unavailable");
    }
    return { status: "ready" as const };
  }
}
