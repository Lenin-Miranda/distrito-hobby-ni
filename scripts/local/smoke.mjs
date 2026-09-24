import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import {
  appPorts,
  compose,
  http,
  inspect,
  ports,
  profile,
  retry,
  root,
  setup,
} from "./core.mjs";

export async function smoke() {
  if (profile === "dev")
    throw new Error("Container smoke requires LOCAL_PROFILE=test or ci.");
  await setup();
  await appPorts();
  try {
    await compose(
      ["up", "--build", "--detach", "--wait", "--wait-timeout", "180"],
      { visible: true },
    );
    await compose(["up", "--detach", "--wait", "--wait-timeout", "180"]);
    await retry(() => http(`http://localhost:${ports.api}/api/v1/ready`));
    for (const service of ["web", "api"]) {
      const container = await inspect(await compose(["ps", "-q", service]));
      assert.equal(container.Config.User, "node");
      assert.equal(container.HostConfig.Init, true);
      assert.ok(container.Mounts.every((mount) => mount.Type !== "bind"));
      for (const values of Object.values(container.NetworkSettings.Ports))
        for (const value of values ?? [])
          assert.equal(value.HostIp, "127.0.0.1");
      const env = container.Config.Env.join("\n");
      assert.ok(
        !env.includes("DIRECT_URL=") && !env.includes("SHADOW_DATABASE_URL="),
      );
      if (service === "web") assert.ok(!env.includes("DATABASE_URL="));
    }
    const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
    const { chromium } = requireWeb("@playwright/test");
    const browser = await chromium.launch();
    try {
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 360, height: 800 },
      ]) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("response", (response) => {
          if (
            response.url().includes("/_next/static/") &&
            response.status() !== 200
          )
            errors.push("asset failed");
        });
        await page.goto(`http://localhost:${ports.web}`, {
          waitUntil: "networkidle",
        });
        assert.equal(await page.locator("main").count(), 1);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
        const result = await page.evaluate(
          async (api) => (await fetch(`${api}/ready`)).status,
          `http://localhost:${ports.api}/api/v1`,
        );
        assert.equal(result, 200);
        await page.goto(`http://localhost:${ports.web}/system-status`, {
          waitUntil: "networkidle",
        });
        assert.equal(
          await page.getByRole("status").textContent(),
          "API available",
        );
        assert.ok(
          (await page.locator("main").innerText()).includes("Database ready"),
        );
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser.close();
    }
    console.log(
      "PASS: container Prisma readiness, isolated non-root runtimes, repeat up, browser CORS, SSR, desktop/mobile and static assets.",
    );
  } finally {
    await compose(["down", "--remove-orphans"]);
  }
}
