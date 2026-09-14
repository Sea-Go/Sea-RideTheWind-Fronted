const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const original = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return original.call(
    this,
    name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name,
    ...args,
  );
};
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const { knowledge } = require("../src/features/knowledge/api.ts");
const {
  CommandKeys,
  statusName,
  isPending,
  parseProfiles,
} = require("../src/features/knowledge/state.ts");
const { isKnowledgeRoute } = require("../src/server/knowledge-routes.ts");
const route = require("../src/app/api/sea/[...path]/route.ts");
const { NextRequest } = require("next/server");
const generated = require("../src/features/knowledge/generated/routes.json");

for (const item of generated)
  test(`H02 generated product route ${item.method} ${item.path}`, () => {
    assert.equal(
      isKnowledgeRoute(item.path.replace(/\{[^}]+\}/g, "example-id"), item.method),
      true,
    );
  });
test("worker transitions and unsupported methods are not browser product routes", () => {
  for (const p of [
    "internal/v1/knowledge/builds/a",
    "knowledge/builds/a/claim",
    "knowledge/builds/a/results",
    "knowledge/compiles/a/results",
  ])
    assert.equal(isKnowledgeRoute(p, "POST"), false);
  assert.equal(isKnowledgeRoute("knowledge/modules/a/activation", "GET"), false);
  assert.equal(isKnowledgeRoute("knowledge/modules", "DELETE"), false);
});
test("unbuilt, cancelled, superseded and unknown states remain distinct", () => {
  assert.equal(statusName("NOT_BUILT"), "尚未构建");
  assert.equal(statusName("CANCELLED"), "已取消");
  assert.equal(statusName("SUPERSEDED"), "已被新任务替代");
  assert.match(statusName("FUTURE_STATE"), /未知状态/);
  assert.equal(isPending("READY"), false);
  assert.equal(isPending("BUILDING"), true);
  assert.equal(isPending("ACCEPTED"), false);
});
test("failed command retries retain identity; edits and completed intents receive new keys", () => {
  const keys = new CommandKeys();
  const input = { release_id: "r1", expected_pointer_revision: 2 };
  const first = keys.key("publish", input);
  assert.equal(keys.key("publish", { ...input }), first);
  assert.notEqual(keys.key("publish", { ...input, release_id: "r2" }), first);
  keys.complete("publish", input);
  assert.notEqual(keys.key("publish", input), first);
});
test("release input requires three independent, complete representation profiles", () => {
  const profiles = ["dense", "sparse", "multivector"].map((lane) => ({
    lane,
    encoder: `${lane}-approved`,
    tokenizer: "t1",
    space: `${lane}-space`,
    dimensions: 4,
    ...(lane === "multivector" ? { mask: "attention", aggregation: "maxsim" } : {}),
  }));
  assert.deepEqual(parseProfiles(JSON.stringify(profiles)), profiles);
  assert.throws(() => parseProfiles("[]"));
  assert.throws(() => parseProfiles(JSON.stringify([profiles[0], profiles[0], profiles[2]])));
  assert.throws(() =>
    parseProfiles(JSON.stringify(profiles.map((p) => ({ ...p, dimensions: 0 })))),
  );
});
test("real client preserves draft/public separation and immutable revision identities", async (t) => {
  const calls = [];
  t.mock.method(global, "fetch", async (url, init) => {
    calls.push({ url, init });
    return Response.json({ code: 200, msg: "ok", data: { revision_id: "r2" } });
  });
  const signal = new AbortController().signal;
  await knowledge.modules("cursor/2", signal, true);
  await knowledge.modules("", signal, false);
  const source = {
    title: "书A",
    content: "原文",
    media_type: "text/markdown",
    provenance: "书A第1页",
    source_id: "source-a",
    base_revision_id: "r1",
    idempotency_key: "key1",
  };
  await knowledge.source("module/a", source);
  assert.match(calls[0].url, /workbench\/modules\?limit=12&cursor=cursor%2F2$/);
  assert.equal(calls[1].url, "/api/sea/knowledge/modules?limit=12");
  assert.equal(calls[0].init.signal, signal);
  assert.equal(calls[2].url, "/api/sea/knowledge/modules/module%2Fa/sources");
  assert.deepEqual(JSON.parse(calls[2].init.body), source);
});
test("BFF forwards 409 unchanged, and current state is not manufactured on errors", async (t) => {
  process.env.SEA_PRODUCT_API_SERVER_URL = "http://127.0.0.1:1";
  t.after(() => delete process.env.SEA_PRODUCT_API_SERVER_URL);
  t.mock.method(global, "fetch", async (url, init) => {
    assert.equal(url, "http://127.0.0.1:1/v1/knowledge/modules/a/activation");
    assert.equal(init.method, "PUT");
    return Response.json({ code: 409, msg: "pointer conflict", data: null }, { status: 409 });
  });
  const result = await route.PUT(
    new NextRequest("http://localhost/api/sea/knowledge/modules/a/activation", {
      method: "PUT",
      body: JSON.stringify({ release_id: "r1" }),
    }),
    { params: Promise.resolve({ path: ["knowledge", "modules", "a", "activation"] }) },
  );
  assert.equal(result.status, 409);
  assert.equal((await result.json()).data, null);
});

function renderWorkbench(snapshot) {
  const slots = [snapshot];
  let cursor = 0;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  const filename = path.join(root, "src/features/knowledge/KnowledgeWorkbench.tsx");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const dependencies = {
    react: hooks,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "@/features/sea/components/primitives": {
      EmptyState: "EmptyState",
      Notice: "Notice",
      SeaLink: "SeaLink",
    },
    "./api": require("../src/features/knowledge/api.ts"),
    "./state": require("../src/features/knowledge/state.ts"),
    "./knowledge.css": {},
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
    module,
    module.exports,
  );
  const render = () => {
    cursor = 0;
    return module.exports.KnowledgeWorkbench({ moduleId: "m1" });
  };
  const nodes = (node) =>
    Array.isArray(node)
      ? node.flatMap(nodes)
      : node && typeof node === "object"
        ? [node, ...nodes(node.props?.children)]
        : [];
  const text = (node) =>
    Array.isArray(node)
      ? node.map(text).join("")
      : node === null || node === undefined || typeof node === "boolean"
        ? ""
        : typeof node === "object"
          ? text(node.props?.children)
          : String(node);
  return {
    find: (predicate) => nodes(render()).find(predicate),
    text: () => text(render()),
    nodeText: text,
  };
}
for (const state of ["NOT_BUILT", "BUILDING", "FAILED", "CANCELLED", "SUPERSEDED", "READY"]) {
  test(`actual workbench displays ${state} and only READY permits publishing`, () => {
    const page = renderWorkbench({
      state: {
        active_release_id: "old",
        active_build_id: "old-build",
        candidate_release_id: "new",
        build_id: "new-build",
        pointer_revision: 1,
        build_state: state,
      },
      revisions: [],
      releases: [],
      builds: [],
      compiles: [],
    });
    assert.ok(page.text().includes(statusName(state)));
    page
      .find((node) => node.type === "button" && page.nodeText(node) === "候选与发布")
      .props.onClick();
    const button = page.find(
      (node) => node.type === "button" && page.nodeText(node) === "手动发布此版本",
    );
    if (state === "READY") {
      assert.ok(button);
      assert.equal(button.props.disabled, true, "publication still needs a reason");
    } else assert.equal(button, undefined);
  });
}
test("metadata without source content cannot be opened as an empty editable revision", () => {
  const page = renderWorkbench({
    state: { build_state: "NOT_BUILT" },
    revisions: [{ revision_id: "r1", kind: "source", title: "Book A", source_refs: [] }],
    releases: [],
    builds: [],
    compiles: [],
  });
  const button = page.find(
    (node) => node.type === "button" && page.nodeText(node) === "正文读取待接入",
  );
  assert.ok(button);
  assert.equal(button.props.disabled, true);
});
