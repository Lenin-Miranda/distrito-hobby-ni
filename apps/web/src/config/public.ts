import { z } from "zod";

const apiUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ["http:", "https:"].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
});

export function getPublicApiBaseUrl(): string {
  // Keep this direct access: Next replaces only the explicitly public variable.
  const value =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
  const result = apiUrl.safeParse(value);
  if (!result.success) throw new Error("Invalid public API configuration");
  return result.data;
}
