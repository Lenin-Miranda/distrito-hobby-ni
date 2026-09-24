import { readyResponseSchema } from "@distrito/contracts";

export async function fetchReady(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_500),
    });
    return (
      response.ok &&
      readyResponseSchema.safeParse(await response.json()).success
    );
  } catch {
    return false;
  }
}
