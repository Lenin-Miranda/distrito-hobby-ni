import "server-only";
import { z } from "zod";

export function getInternalApiBaseUrl(): string {
  const result = z
    .url()
    .safeParse(
      process.env.API_INTERNAL_BASE_URL ?? "http://localhost:4000/api/v1",
    );
  if (!result.success) throw new Error("Invalid server API configuration");
  const url = new URL(result.data);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid server API configuration");
  }
  return result.data;
}
