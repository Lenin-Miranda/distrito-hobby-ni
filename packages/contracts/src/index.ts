import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("distrito-hobby-api"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readyResponseSchema = z.object({ status: z.literal("ready") });
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
