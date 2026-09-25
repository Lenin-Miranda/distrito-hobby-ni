// pnpm deploy 12 includes optional build-tool peers of Prisma/Better Auth.
// Trim only the isolated /out/api artifact, never the workspace installation.
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
const target = process.argv[2];
if (target !== "/out/api")
  throw new Error(
    "Runtime packaging is limited to /out/api in the build stage.",
  );
const modules = path.join(target, "node_modules");
const store = path.join(modules, ".pnpm");
const visited = new Set();
const retained = new Set();
const direct = JSON.parse(
  readFileSync(path.join(target, "package.json"), "utf8"),
).dependencies;
const buildPeers = new Set(["prisma", "typescript", "vitest"]);
function resolvePackage(from, name) {
  let directory = from;
  while (directory.startsWith(target)) {
    const candidate = path.join(directory, "node_modules", name);
    if (existsSync(path.join(candidate, "package.json")))
      return realpathSync(candidate);
    directory = path.dirname(directory);
  }
}
function visit(directory) {
  if (visited.has(directory)) return;
  if (directory !== target && !directory.startsWith(`${target}/`))
    throw new Error("External workspace symlink in deployment.");
  visited.add(directory);
  if (directory.startsWith(`${store}/`))
    retained.add(path.relative(store, directory).split(path.sep)[0]);
  const pkg = JSON.parse(
    readFileSync(path.join(directory, "package.json"), "utf8"),
  );
  const required = Object.keys(pkg.dependencies ?? {});
  const optional = Object.keys(pkg.optionalDependencies ?? {});
  for (const name of Object.keys(pkg.peerDependencies ?? {})) {
    if (
      pkg.peerDependenciesMeta?.[name]?.optional &&
      (buildPeers.has(name) || !direct[name])
    )
      continue;
    (pkg.peerDependenciesMeta?.[name]?.optional ? optional : required).push(
      name,
    );
  }
  for (const name of new Set([...required, ...optional])) {
    const dependency = resolvePackage(directory, name);
    if (!dependency && required.includes(name))
      throw new Error(`Missing runtime package ${name}`);
    if (dependency) visit(dependency);
  }
}
visit(target);
for (const entry of readdirSync(store, { withFileTypes: true })) {
  if (
    entry.isDirectory() &&
    entry.name !== "node_modules" &&
    !retained.has(entry.name)
  )
    rmSync(path.join(store, entry.name), { recursive: true });
}
function clean(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      if (!existsSync(file)) rmSync(file);
      else if (!realpathSync(file).startsWith(`${target}/`))
        throw new Error("External runtime symlink.");
    } else if (entry.isDirectory()) {
      if (entry.name === ".bin") rmSync(file, { recursive: true });
      else clean(file);
    }
  }
}
clean(modules);
const pkg = JSON.parse(readFileSync(path.join(target, "package.json"), "utf8"));
delete pkg.devDependencies;
pkg.scripts = { start: "node dist/main.js" };
writeFileSync(path.join(target, "package.json"), JSON.stringify(pkg, null, 2));
console.log(
  `Runtime artifact contains ${visited.size - 1} dependency packages; optional build tools excluded.`,
);
