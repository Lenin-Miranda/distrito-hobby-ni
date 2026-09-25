import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  appPorts,
  compose,
  http,
  ports,
  profile,
  retry,
  root,
  setup,
} from "./core.mjs";

export async function devSmoke() {
  if (profile === "dev")
    throw new Error(
      "Development reload smoke requires LOCAL_PROFILE=test or ci.",
    );
  await setup();
  await appPorts();
  const files = [
    "packages/contracts/src/index.ts",
    "apps/api/src/modules/health/health.controller.ts",
    "apps/web/src/app/system-status/page.tsx",
  ].map((file) => path.join(root, file));
  const original = files.map((file) => readFileSync(file, "utf8"));
  const changed = [...original];
  let modified = false;
  try {
    await compose(
      [
        "up",
        "--build",
        "--detach",
        "--renew-anon-volumes",
        "--wait",
        "--wait-timeout",
        "180",
      ],
      { dev: true, visible: true },
    );
    const marker = `reload_${Date.now()}`;
    changed[0] =
      original[0] + `\nexport const developmentReloadProbe = "${marker}";\n`;
    changed[1] =
      `import { developmentReloadProbe } from "@distrito/contracts";\n` +
      original[1].replace(
        /}\s*$/,
        '@Get("reload-probe")\nprobe() { return { value: developmentReloadProbe }; }\n}\n',
      );
    changed[2] =
      `import { developmentReloadProbe } from "@distrito/contracts";\n` +
      original[2].replace("<h1 ", "<p>{developmentReloadProbe}</p><h1 ");
    modified = true;
    files.forEach((file, index) => writeFileSync(file, changed[index]));
    const verify = async (value) => {
      assert.equal(
        (
          await (
            await http(
              `http://localhost:${ports.api}/api/v1/health/reload-probe`,
            )
          ).json()
        ).value,
        value,
      );
      assert.ok(
        (
          await (
            await http(`http://localhost:${ports.web}/system-status`)
          ).text()
        ).includes(value),
      );
    };
    await retry(() => verify(marker), 90);
    changed[0] = changed[0].replace(marker, `${marker}_contracts_only`);
    writeFileSync(files[0], changed[0]);
    await retry(() => verify(`${marker}_contracts_only`), 90);
    console.log(
      "PASS: Docker web/API source reload and contract-only rebuild/restart in both consumers.",
    );
  } catch (error) {
    await compose(["logs", "--tail", "60"], { dev: true, visible: true });
    throw error;
  } finally {
    if (modified)
      files.forEach((file, index) => {
        if (readFileSync(file, "utf8") !== changed[index])
          throw new Error(
            "Source changed during reload smoke; refusing to overwrite concurrent edits.",
          );
        writeFileSync(file, original[index]);
      });
    await compose(["down", "--remove-orphans"], { dev: true });
  }
}
