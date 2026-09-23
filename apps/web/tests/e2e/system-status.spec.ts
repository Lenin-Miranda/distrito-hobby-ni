import { expect, test } from "@playwright/test";

test("Next.js calls the real compiled Nest API at request time", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/system-status");
  await expect(
    page.getByRole("heading", { name: "System status" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("API available");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  expect(await page.locator("body").innerText()).not.toContain("4100");
  expect(errors).toEqual([]);
});

test("browser HTTP access obeys the actual API CORS allowlist", async ({
  page,
}) => {
  await page.goto("/");
  const health = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:4100/api/v1/health");
    return response.json();
  });
  expect(health).toEqual({ status: "ok", service: "distrito-hobby-api" });

  await page.goto("http://127.0.0.1:3101/");
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("http://127.0.0.1:4100/api/v1/health");
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});

test("an unavailable API shows a safe error and leaves the home page working", async ({
  page,
  request,
}) => {
  // Fail if another local service occupies the intentionally unused endpoint.
  await expect(
    request.get("http://127.0.0.1:4199/api/v1/health", { timeout: 1_000 }),
  ).rejects.toThrow();
  await page.goto("http://127.0.0.1:3101/system-status");
  await expect(page.getByRole("status")).toHaveText(
    "API unavailable. Please try again later.",
  );
  const content = await page.locator("body").innerText();
  expect(content).not.toMatch(/4199|API_INTERNAL_BASE_URL|ECONNREFUSED|stack/i);
  await page.goto("http://127.0.0.1:3101/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Distrito Hobby" }),
  ).toBeVisible();
  await expect(page.getByText("Something awesome is coming.")).toBeVisible();
});
