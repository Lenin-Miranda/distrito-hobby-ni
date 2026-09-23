import { Injectable } from "@nestjs/common";
import { healthResponseSchema, type HealthResponse } from "@distrito/contracts";

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return healthResponseSchema.parse({
      status: "ok",
      service: "distrito-hobby-api",
    });
  }
}
