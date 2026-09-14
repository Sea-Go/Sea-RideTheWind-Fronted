const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const root = process.argv[2];
if (!root) throw new Error("usage: node scripts/sync-knowledge-contract.cjs <RTW checkout>");
const source = fs.readFileSync(path.join(root, "api/knowledge.api"));
const swagger = JSON.parse(
  fs.readFileSync(path.join(root, "service/knowledge/generated/knowledge.json")),
);
const target = path.join(__dirname, "../src/features/knowledge/generated");
fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(
  path.join(root, "service/knowledge/generated/typescript/knowledgeComponents.ts"),
  path.join(target, "knowledgeComponents.ts"),
);
const routes = Object.entries(swagger.paths)
  .filter(([p]) => p.startsWith("/v1/knowledge/"))
  .flatMap(([p, operations]) =>
    Object.keys(operations).map((method) => ({ method: method.toUpperCase(), path: p.slice(4) })),
  );
fs.writeFileSync(path.join(target, "routes.json"), JSON.stringify(routes, null, 2) + "\n");
fs.writeFileSync(
  path.join(target, "source.json"),
  JSON.stringify(
    {
      contract: "api/knowledge.api",
      provider_commit: cp
        .execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" })
        .trim(),
      api_sha256: crypto.createHash("sha256").update(source).digest("hex"),
      generator: "goctl 1.9.2",
      background: "BG-2026-09-13-r2",
    },
    null,
    2,
  ) + "\n",
);

cp.execFileSync(
  process.execPath,
  [require.resolve("prettier/bin/prettier.cjs"), "--write", target],
  { stdio: "inherit" },
);
