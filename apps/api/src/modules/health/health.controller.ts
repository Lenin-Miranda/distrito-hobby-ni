import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@distrito/contracts";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthResponse {
    return this.healthService.check();
  }
}
