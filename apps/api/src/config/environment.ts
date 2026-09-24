import { z } from "zod";

const webOrigins = z
  .string()
  .transform((value) => value.split(",").map((origin) => origin.trim()))
  .pipe(
    z
      .array(
        z.string().refine((origin) => {
          try {
            const url = new URL(origin);
            return (
              !origin.includes("*") &&
              ["http:", "https:"].includes(url.protocol) &&
              url.origin === origin
            );
          } catch {
            return false;
          }
        }, "Expected an explicit HTTP(S) origin without a path"),
      )
      .min(1),
  );

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGINS: webOrigins.default(["http://localhost:3000"]),
  DATABASE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DATABASE_URL: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // Do not include Zod's input values or arbitrary environment contents in errors.
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ];
    throw new Error(`Invalid API configuration: ${fields.join(", ")}`);
  }
  if (result.data.NODE_ENV === "production" && !input.WEB_ORIGINS) {
    throw new Error(
      "Invalid API configuration: WEB_ORIGINS is required in production",
    );
  }
  if (result.data.DATABASE_ENABLED) {
    try {
      const url = new URL(result.data.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !url.hostname ||
        !url.username ||
        !url.password ||
        url.pathname === "/"
      )
        throw new Error();
    } catch {
      throw new Error(
        "Invalid API configuration: DATABASE_URL is required when DATABASE_ENABLED=true",
      );
    }
  }
  return result.data;
}
