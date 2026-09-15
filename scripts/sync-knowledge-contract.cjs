const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const root = process.argv[2];
const historyOnly = process.argv[3] === "--v2-history-only";
if (!root || (process.argv[3] && !historyOnly))
  throw new Error(
    "usage: node scripts/sync-knowledge-contract.cjs <RTW checkout> [--v2-history-only]",
  );
const source = fs.readFileSync(path.join(root, "api/knowledge.api"));
const swagger = JSON.parse(
  fs.readFileSync(path.join(root, "service/knowledge/generated/knowledge.json")),
);
const target = path.join(__dirname, "../src/features/knowledge/generated");
fs.mkdirSync(target, { recursive: true });
const components = path.join(root, "service/knowledge/generated/typescript/knowledgeComponents.ts");
if (!historyOnly) fs.copyFileSync(components, path.join(target, "knowledgeComponents.ts"));
else {
  const ts = require("typescript");
  const generated = fs.readFileSync(components, "utf8");
  const file = ts.createSourceFile(components, generated, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) throw new Error("RTW goctl TypeScript contains parse errors");
  const declarations = new Map(
    file.statements.filter(ts.isInterfaceDeclaration).map((node) => [node.name.text, node]),
  );
  const roots = [
    "AcceptedSubjectRefV2",
    "AcceptedAnswerV2",
    "AcceptedAnswerV2Envelope",
    "AcceptedAnswersPageV2",
    "AcceptedAnswersPageV2Envelope",
  ];
  const selected = new Set();
  const include = (name) => {
    const node = declarations.get(name);
    if (!node) throw new Error(`RTW goctl is missing v2 history DTO ${name}`);
    if (selected.has(name)) return;
    selected.add(name);
    const walk = (child) => {
      if (ts.isTypeReferenceNode(child)) {
        const dependency = child.typeName.getText(file);
        if (declarations.has(dependency)) include(dependency);
      }
      ts.forEachChild(child, walk);
    };
    ts.forEachChild(node, walk);
  };
  roots.forEach(include);
  const dto = file.statements
    .filter((node) => ts.isInterfaceDeclaration(node) && selected.has(node.name.text))
    .map((node) => node.getText(file))
    .join("\n\n");
  fs.writeFileSync(
    path.join(target, "knowledgeComponentsV2.ts"),
    `// Generated from RTW goctl TypeScript; v2 history DTOs and their type dependencies.\n${dto}\n`,
  );
}
const routes = Object.entries(swagger.paths)
  .filter(([p]) => p.startsWith("/v1/knowledge/"))
  .flatMap(([p, operations]) =>
    Object.keys(operations).map((method) => ({ method: method.toUpperCase(), path: p.slice(4) })),
  );
if (!historyOnly)
  fs.writeFileSync(path.join(target, "routes.json"), JSON.stringify(routes, null, 2) + "\n");
if (historyOnly) {
  const v2HistoryRoutes = Object.entries(swagger.paths)
    .filter(([p]) => p.startsWith("/v2/knowledge/"))
    .flatMap(([p, operations]) =>
      Object.keys(operations).map((method) => ({ method: method.toUpperCase(), path: p.slice(4) })),
    )
    .sort((a, b) => a.path.localeCompare(b.path));
  const expectedV2History = [
    "knowledge/answer-sessions/{session_id}/accepted-answers",
    "knowledge/answer-sessions/{session_id}/accepted-answers/{answer_id}",
    "knowledge/answer-sessions/{session_id}/accepted-answers/{answer_id}/citations",
  ];
  if (
    v2HistoryRoutes.length !== expectedV2History.length ||
    v2HistoryRoutes.some(
      (route, i) => route.method !== "GET" || route.path !== expectedV2History[i],
    )
  )
    throw new Error("RTW v2 product contract must expose exactly three history GET routes");
  fs.writeFileSync(
    path.join(target, "routes-v2-history.json"),
    JSON.stringify(v2HistoryRoutes, null, 2) + "\n",
  );
}
const sourceMetadata = {
  contract: "api/knowledge.api",
  provider_commit: cp
    .execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" })
    .trim(),
  api_sha256: crypto.createHash("sha256").update(source).digest("hex"),
  generator: "goctl 1.9.2",
  ...(historyOnly
    ? {
        components_sha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(components))
          .digest("hex"),
      }
    : {}),
};
fs.writeFileSync(
  path.join(target, historyOnly ? "source-v2-history.json" : "source.json"),
  JSON.stringify(
    {
      ...sourceMetadata,
      ...(historyOnly ? {} : { background: "BG-2026-09-13-r2" }),
    },
    null,
    2,
  ) + "\n",
);

cp.execFileSync(
  process.execPath,
  [
    require.resolve("prettier/bin/prettier.cjs"),
    "--write",
    ...(historyOnly
      ? [
          path.join(target, "knowledgeComponentsV2.ts"),
          path.join(target, "routes-v2-history.json"),
          path.join(target, "source-v2-history.json"),
        ]
      : [target]),
  ],
  { stdio: "inherit" },
);
