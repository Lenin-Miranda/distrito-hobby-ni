import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
const web = path.resolve(import.meta.dirname, "../apps/web");
const target = path.join(web, ".next/standalone/apps/web");
if (!existsSync(path.join(target, "server.js")))
  throw new Error("Missing monorepo standalone server; build Next first.");
mkdirSync(path.join(target, "public"), { recursive: true });
for (const entry of [".next/static", "public"]) {
  if (existsSync(path.join(web, entry)))
    cpSync(path.join(web, entry), path.join(target, entry), {
      recursive: true,
    });
}
