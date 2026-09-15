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
  for (const aggregation of ["sum_maxsim", "mean_maxsim"]) {
    const explicit = profiles.map((p) => (p.lane === "multivector" ? { ...p, aggregation } : p));
    assert.deepEqual(parseProfiles(JSON.stringify(explicit)), explicit);
  }
  const unknown = profiles.map((p) =>
    p.lane === "multivector" ? { ...p, aggregation: "unknown" } : p,
  );
  assert.throws(() => parseProfiles(JSON.stringify(unknown)));

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
  const slots = [{ module: { title: "测试模块", sources: 0, pages: 0 }, next: {}, ...snapshot }];
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
    "./RevisionCompare": { RevisionCompare: "RevisionCompare" },
    "./WikiFactQualityReview": { WikiFactQualityReview: "WikiFactQualityReview" },
    "./WikiFactSetWorkbench": { WikiFactSetWorkbench: "WikiFactSetWorkbench" },
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
test("human Wiki fact review receives fixed revisions and the separate published Release pointer", () => {
  const fixed = { revision_id: "wiki-r1", entity_id: "page-a", kind: "wiki" };
  const page = renderWorkbench({
    state: { active_release_id: "published-r1", build_state: "READY" },
    revisions: [fixed],
    releases: [],
    builds: [],
    compiles: [],
  });
  page.find((node) => node.type === "button" && page.nodeText(node) === "事实核验").props.onClick();
  const review = page.find((node) => node.type === "WikiFactQualityReview");
  assert.equal(review.props.moduleId, "m1");
  assert.deepEqual(review.props.revisions, [fixed]);
  assert.equal(review.props.publishedReleaseId, "published-r1");
});
test("editing metadata fetches a fixed body and preserves existing input on failure", async (t) => {
  const page = renderWorkbench({
    state: { build_state: "NOT_BUILT" },
    revisions: [{ revision_id: "r1", kind: "source", title: "Book A", source_refs: [] }],
    releases: [],
    builds: [],
    compiles: [],
  });
  page
    .find((n) => n.type === "textarea" && n.props.required)
    .props.onChange({ target: { value: "尚未保存的原文" } });
  t.mock.method(global, "fetch", async (url) => {
    assert.equal(url, "/api/sea/knowledge/modules/m1/revisions/r1");
    return Response.json({ code: 410, msg: "revision withdrawn", data: null }, { status: 410 });
  });
  page.find((n) => n.type === "button" && page.nodeText(n) === "基于此修订编辑").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    page.find((n) => n.type === "textarea" && n.props.required).props.value,
    "尚未保存的原文",
  );
  assert.ok(page.text().includes("revision withdrawn"));
});
test("refreshed history publishes the selected old READY build using the current pointer", async (t) => {
  const page = renderWorkbench({
    state: {
      active_release_id: "new",
      active_build_id: "new-build",
      candidate_release_id: "new",
      build_id: "new-build",
      pointer_revision: 7,
      build_state: "READY",
    },
    revisions: [],
    releases: [
      { release_id: "old", ordinal: 1, source_revision_ids: [], wiki_revision_ids: [] },
      { release_id: "new", ordinal: 2, source_revision_ids: [], wiki_revision_ids: [] },
    ],
    compiles: [],
    builds: [{ build_id: "old-build", release_id: "old", state: "READY", generation: 1 }],
  });
  page.find((n) => n.type === "button" && page.nodeText(n) === "候选与发布").props.onClick();
  page
    .find((n) => n.type === "textarea" && n.props.rows === 3)
    .props.onChange({ target: { value: "确认回滚" } });
  let sent;
  t.mock.method(global, "fetch", async (_url, init) => {
    sent = JSON.parse(init.body);
    return Response.json({
      code: 200,
      msg: "ok",
      data: {
        active_release_id: "old",
        active_build_id: "old-build",
        pointer_revision: 8,
        build_state: "READY",
      },
    });
  });
  page.find((n) => n.type === "button" && page.nodeText(n) === "回滚到此就绪版本").props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.release_id, "old");
  assert.equal(sent.build_id, "old-build");
  assert.equal(sent.expected_pointer_revision, 7);
  assert.ok(sent.idempotency_key);
  assert.ok(page.text().includes("手动切换成功"));
});
test("fixed reading links bind release and revision; locators follow backend literal blank lines", () => {
  const { revisionHref, sourceParagraph } = require("../src/features/knowledge/state.ts");
  assert.equal(
    revisionHref("m1", "published-r1", { revision_id: "source-v1", kind: "source" }, "paragraph:2"),
    "/knowledge/m1/sources?release=published-r1&revision=source-v1&locator=paragraph%3A2#source-location",
  );
  assert.equal(
    sourceParagraph("第一块\r\n\r\n第二块\n \n仍然第二块", "paragraph:2"),
    "第二块\n \n仍然第二块",
  );
  assert.equal(sourceParagraph("第一块", "paragraph:2"), null);
});
test("public reading routes remain public and workbench keeps its existing login behavior", () => {
  const { proxy } = require("../src/proxy.ts");
  for (const route of [
    "/knowledge",
    "/knowledge/m1",
    "/knowledge/m1/read",
    "/knowledge/m1/sources",
  ]) {
    assert.equal(proxy(new NextRequest(`http://localhost${route}`)).status, 200);
  }
  for (const route of ["/workbench/modules", "/knowledge/workbench", "/knowledge/m1/workbench"]) {
    assert.equal(proxy(new NextRequest(`http://localhost${route}`)).status, 307);
  }
});

test("generated consumer types accept default pagination and terminal pages", () => {
  const os = require("node:os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sea-knowledge-type-consumer-"));
  try {
    const fixture = path.join(dir, "consumer.ts");
    const source = path.join(root, "src/features/knowledge/generated/knowledgeComponents");
    fs.writeFileSync(
      fixture,
      `import type { ListModulesReqParams, ModulePageReqParams, PublishedRevisionsReqParams, ListModulesResp, ListRevisionsResp, ListBuildsResp, ListCompilesResp, ListReleasesResp } from ${JSON.stringify(source)};
const defaults: [ListModulesReqParams, ModulePageReqParams, PublishedRevisionsReqParams] = [{}, {}, {}];
const terminal: [ListModulesResp, ListRevisionsResp, ListBuildsResp, ListCompilesResp, ListReleasesResp] = [{items:[]},{items:[]},{items:[]},{items:[]},{items:[]}];
void defaults; void terminal;
`,
    );
    const program = ts.createProgram([fixture], {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      types: [],
    });
    const errors = ts
      .getPreEmitDiagnostics(program)
      .filter((d) => d.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(
      errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
      [],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
