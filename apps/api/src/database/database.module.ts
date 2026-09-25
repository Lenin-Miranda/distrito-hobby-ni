import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";
import { ReadyController } from "./ready.controller.js";

@Module({
  providers: [PrismaService],
  controllers: [ReadyController],
  exports: [PrismaService],
})
export class DatabaseModule {}
