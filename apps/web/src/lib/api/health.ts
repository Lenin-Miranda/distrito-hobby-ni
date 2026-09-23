import { healthResponseSchema, type HealthResponse } from "@distrito/contracts";

export class HealthRequestError extends Error {
  constructor(public readonly code: "unavailable" | "http" | "contract") {
    super("The API health response is unavailable");
    this.name = "HealthRequestError";
  }
}

export async function fetchHealth(
  baseUrl: string,
  timeoutMs = 3_000,
): Promise<HealthResponse> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
      redirect: "error",
    });
    if (!response.ok) throw new HealthRequestError("http");
    const result = healthResponseSchema.safeParse(await response.json());
    if (!result.success) throw new HealthRequestError("contract");
    return result.data;
  } catch (error) {
    if (error instanceof HealthRequestError) throw error;
    throw new HealthRequestError("unavailable");
  }
}
