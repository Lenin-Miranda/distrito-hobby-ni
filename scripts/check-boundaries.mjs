import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const violations = [];
const forbiddenWeb =
  /^(?:@distrito\/api(?:\/|$)|@prisma\/|prisma(?:\/|$)|better-auth(?:\/|$))/;

function checkFile(file, boundary) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const checkImport = (specifier) => {
    const alias = specifier.startsWith("@/");
    const relative =
      alias || specifier.startsWith(".") || path.isAbsolute(specifier);
    const resolved = alias
      ? path.resolve(boundary, "src", specifier.slice(2))
      : path.resolve(path.dirname(file), specifier);
    const outside = relative && !resolved.startsWith(boundary + path.sep);
    const contracts = boundary.endsWith("packages/contracts");
    const invalid = contracts
      ? outside || (!relative && specifier !== "zod")
      : outside ||
        forbiddenWeb.test(specifier) ||
        /(?:^|\/)apps\/api(?:\/|$)/.test(specifier);
    if (invalid)
      violations.push(
        `${path.relative(root, file)}: forbidden import ${specifier}`,
      );
  };
  function visit(node) {
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      checkImport(node.argument.literal.text);
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      checkImport(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) checkImport(arg.text);
      else
        violations.push(
          `${path.relative(root, file)}: nonliteral module loading requires review`,
        );
    }
    if (
      boundary.endsWith("packages/contracts") &&
      ts.isIdentifier(node) &&
      ["process", "window", "document", "globalThis"].includes(node.text)
    )
      violations.push(
        `${path.relative(root, file)}: contracts must remain environment-independent`,
      );
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

function walk(dir, boundary) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, boundary);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) checkFile(file, boundary);
  }
}

for (const relative of ["apps/web", "packages/contracts"]) {
  const boundary = path.join(root, relative);
  walk(path.join(boundary, "src"), boundary);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(boundary, "package.json"), "utf8"),
  );
  for (const dependency of Object.keys(pkg.dependencies ?? {})) {
    if (
      relative === "packages/contracts"
        ? dependency !== "zod"
        : forbiddenWeb.test(dependency)
    )
      violations.push(
        `${relative}: forbidden runtime dependency ${dependency}`,
      );
  }
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else console.log("Package boundaries verified.");
