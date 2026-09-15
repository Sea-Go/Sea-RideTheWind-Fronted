const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(
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

const {
  originalFactSpan,
  previewFactID,
  previewFactSetScope,
} = require("../src/features/knowledge/fact-set-source.ts");
const { knowledgeFactSets } = require("../src/features/knowledge/api.ts");
const {
  isKnowledgeRoute,
  isKnowledgeWikiReviewRoute,
} = require("../src/server/knowledge-routes.ts");
const bff = require("../src/app/api/sea/[...path]/route.ts");
const { NextRequest } = require("next/server");

const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const revision = (id, kind, content, other = {}) => ({
  revision_id: id,
  module_id: "module-a",
  entity_id: kind === "wiki" ? "page-a" : id,
  kind,
  media_type: "text/plain",
  content,
  content_hash: sha(content),
  source_refs: [],
  created_by: "admin-fixture",
  base_revision_id: "",
  withdrawn: false,
  ...other,
});

test("accepted AI scope includes every frozen Compile Source, even an uncited one", async () => {
  const sourceA = revision("source-a", "source", "原文 A");
  const sourceB = revision("source-b", "source", "原文 B");
  const wiki = revision("wiki-a", "wiki", "Wiki A", {
    created_by: "btw.compile/compile-a",
    source_refs: [{ revision_id: "source-a", locator: "paragraph:1" }],
  });
  const sources = new Map([sourceA, sourceB, wiki].map((item) => [item.revision_id, item]));
  const preview = await previewFactSetScope("module-a", "page-a", "wiki-a", {
    revision: async (id) => sources.get(id),
    compile: async (id) => {
      assert.equal(id, "compile-a");
      return {
        state: "ACCEPTED",
        module_id: "module-a",
        page_id: "page-a",
        revision_id: "wiki-a",
        source_revision_ids: ["source-a", "source-b"],
      };
    },
    olderRevisions: {
      nextCursor: "unused",
      page: async () => {
        throw new Error("ordinary accepted AI preview must not paginate metadata");
      },
    },
  });
  assert.deepEqual(
    preview.sources.map((source) => source.revision_id),
    ["source-a", "source-b"],
  );
  assert.equal(preview.originCompileId, "compile-a");
  const canonical = JSON.stringify({
    module_id: "module-a",
    page_id: "page-a",
    source_revisions: preview.sourceRevisions.map(({ revision_id, content_sha256 }) => ({
      content_sha256,
      revision_id,
    })),
  });
  assert.equal(preview.sourceScopeRevision, `scope_${sha(canonical)}`);
});

test("manual descendant retains active AI ancestor sources and excludes only formally withdrawn ancestor", async () => {
  const current = revision("source-current", "source", "当前事实");
  const old = revision("source-old", "source", "历史事实");
  const withdrawn = revision("source-withdrawn", "source", "已撤回事实", { withdrawn: true });
  const ai = revision("wiki-ai", "wiki", "已接纳正文", {
    created_by: "btw.compile/compile-base",
    source_refs: [{ revision_id: "source-old", locator: "paragraph:1" }],
    withdrawn: true,
  });
  const manual = revision("wiki-manual", "wiki", "人工维护正文", {
    base_revision_id: "wiki-ai",
    source_refs: [{ revision_id: "source-current", locator: "paragraph:1" }],
  });
  const entries = new Map(
    [current, old, withdrawn, ai, manual].map((item) => [item.revision_id, item]),
  );
  const preview = await previewFactSetScope("module-a", "page-a", "wiki-manual", {
    revision: async (id) => {
      if (id === "source-withdrawn") throw new Error("withdrawn Source body must not be read");
      if (id === "wiki-ai") throw new Error("withdrawn ancestor Wiki body must not be read");
      return entries.get(id);
    },
    compile: async () => ({
      state: "ACCEPTED",
      module_id: "module-a",
      page_id: "page-a",
      revision_id: "wiki-ai",
      source_revision_ids: ["source-old", "source-withdrawn"],
    }),
    knownRevisions: [current, old, withdrawn, ai, manual],
  });
  assert.equal(preview.originCompileId, "");
  assert.deepEqual(
    preview.sources.map((source) => source.revision_id),
    ["source-current", "source-old"],
  );
  const bad = revision("wiki-bad", "wiki", "错误当前引用", {
    source_refs: [{ revision_id: "source-withdrawn", locator: "paragraph:1" }],
  });
  entries.set(bad.revision_id, bad);
  await assert.rejects(
    () =>
      previewFactSetScope("module-a", "page-a", bad.revision_id, {
        revision: async (id) => entries.get(id),
        compile: async () => {
          throw new Error("manual target has no Compile");
        },
        knownRevisions: [withdrawn],
      }),
    /已撤回/,
  );
});

test("missing withdrawn manual ancestor is confirmed from bounded older admin pages only on failed fixed GET", async () => {
  const current = revision("source-current", "source", "当前事实");
  const retired = revision("source-retired", "source", "旧事实", { withdrawn: true });
  const ancestor = revision("wiki-ancestor", "wiki", "旧 Wiki", {
    source_refs: [{ revision_id: retired.revision_id, locator: "paragraph:1" }],
    withdrawn: true,
  });
  const manual = revision("wiki-manual", "wiki", "当前 Wiki", {
    base_revision_id: ancestor.revision_id,
    source_refs: [{ revision_id: current.revision_id, locator: "paragraph:1" }],
  });
  const calls = [];
  const preview = await previewFactSetScope("module-a", "page-a", manual.revision_id, {
    revision: async (id) => {
      calls.push(`GET:${id}`);
      if (id === retired.revision_id) throw new Error("retired body: 410");
      return id === manual.revision_id ? manual : current;
    },
    compile: async () => {
      throw new Error("no AI Compile");
    },
    knownRevisions: [manual, ancestor, current],
    olderRevisions: {
      nextCursor: "older-1",
      page: async (cursor) => {
        calls.push(`PAGE:${cursor}`);
        if (cursor === "older-1")
          return { items: [revision("unrelated", "source", "别的来源")], next_cursor: "older-2" };
        assert.equal(cursor, "older-2");
        return { items: [retired] };
      },
    },
  });
  assert.deepEqual(
    preview.sources.map((source) => source.revision_id),
    [current.revision_id],
  );
  assert.deepEqual(calls, [
    "GET:wiki-manual",
    "GET:source-current",
    "GET:source-retired",
    "PAGE:older-1",
    "PAGE:older-2",
  ]);
});

test("unknown, bad, or looping old Source metadata never becomes an omitted FactSet Source", async () => {
  const current = revision("source-current", "source", "当前事实");
  const retiredId = "source-retired";
  const ancestor = revision("wiki-ancestor", "wiki", "旧 Wiki", {
    source_refs: [{ revision_id: retiredId, locator: "paragraph:1" }],
    withdrawn: true,
  });
  const manual = revision("wiki-manual", "wiki", "当前 Wiki", {
    base_revision_id: ancestor.revision_id,
    source_refs: [{ revision_id: current.revision_id, locator: "paragraph:1" }],
  });
  const base = {
    revision: async (id) => {
      if (id === retiredId) throw new Error("retired body unavailable");
      return id === manual.revision_id ? manual : current;
    },
    compile: async () => {
      throw new Error("no AI Compile");
    },
    knownRevisions: [manual, ancestor, current],
  };
  const preview = (page) =>
    previewFactSetScope("module-a", "page-a", manual.revision_id, {
      ...base,
      olderRevisions: { nextCursor: "older-1", page },
    });
  await assert.rejects(
    () => preview(async () => ({ items: [], next_cursor: "" })),
    /未确认正式撤回/,
  );
  await assert.rejects(
    () =>
      preview(async () => ({
        items: [revision(retiredId, "source", "旧事实", { withdrawn: true, module_id: "other" })],
      })),
    /身份或状态不符/,
  );
  await assert.rejects(
    () => preview(async () => ({ items: [], next_cursor: "older-1" })),
    /游标重复/,
  );
  let pages = 0;
  await assert.rejects(
    () =>
      preview(async () => ({
        items: [],
        next_cursor: `older-${++pages + 1}`,
      })),
    /超过 32 页上限/,
  );
  assert.equal(pages, 32);
});

test("current or AI fixed Source cannot be retired by older metadata pagination", async () => {
  const retiredId = "source-retired";
  const old = revision(retiredId, "source", "旧事实", { withdrawn: true });
  const manual = revision("wiki-current", "wiki", "当前 Wiki", {
    source_refs: [{ revision_id: retiredId, locator: "paragraph:1" }],
  });
  const ai = revision("wiki-ai", "wiki", "AI Wiki", {
    created_by: "btw.compile/compile-a",
    source_refs: [{ revision_id: retiredId, locator: "paragraph:1" }],
  });
  let pageCalls = 0;
  const readers = {
    revision: async (id) => {
      if (id === retiredId) throw new Error("retired body: 410");
      return id === manual.revision_id ? manual : ai;
    },
    compile: async () => ({
      state: "ACCEPTED",
      module_id: "module-a",
      page_id: "page-a",
      revision_id: ai.revision_id,
      source_revision_ids: [retiredId],
    }),
    olderRevisions: {
      nextCursor: "older-1",
      page: async () => {
        pageCalls++;
        return { items: [old] };
      },
    },
  };
  await assert.rejects(
    () => previewFactSetScope("module-a", "page-a", manual.revision_id, readers),
    /正文不可取/,
  );
  await assert.rejects(
    () => previewFactSetScope("module-a", "page-a", ai.revision_id, readers),
    /正文不可取/,
  );
  assert.equal(pageCalls, 0);
});

test("Fact quote preview uses RTW original UTF-8 byte span and FactID input", async () => {
  const source = revision("source-a", "source", "甲\r\n乙\r\n\r\n乙乙\r\n末尾");
  const span = originalFactSpan(source, "paragraph:2", "乙");
  const original = Buffer.from(source.content);
  assert.equal(span.paragraph, "乙乙\r\n末尾");
  assert.equal(span.start, original.indexOf(Buffer.from("乙乙")));
  assert.equal(span.end, span.start + Buffer.byteLength("乙"));
  const quoteSHA = sha("乙");
  assert.equal(
    await previewFactID("source-a", "paragraph:2", "乙"),
    `fact_${sha(`source-a\0paragraph:2\0${quoteSHA}`)}`,
  );
  assert.equal(originalFactSpan(source, "paragraph:2", "不存在"), null);
});

test("FactSet product routes use admin identity, explicit by-ID history, and never expose Worker Event", async (t) => {
  const oldBase = process.env.SEA_PRODUCT_API_SERVER_URL;
  process.env.SEA_PRODUCT_API_SERVER_URL = "http://127.0.0.1:1";
  t.after(() => {
    if (oldBase === undefined) delete process.env.SEA_PRODUCT_API_SERVER_URL;
    else process.env.SEA_PRODUCT_API_SERVER_URL = oldBase;
  });
  const paths = [
    ["GET", "knowledge/modules/m/wiki-pages/p/fact-sets/scope_" + "a".repeat(64)],
    ["GET", "knowledge/modules/m/wiki-pages/p/fact-set-revisions/rev-1"],
    ["POST", "knowledge/modules/m/wiki-pages/p/revisions/wiki-1/fact-sets"],
  ];
  for (const [method, route] of paths) {
    assert.equal(isKnowledgeRoute(route, method), true);
    assert.equal(isKnowledgeWikiReviewRoute(route), true);
  }
  assert.equal(isKnowledgeRoute("internal/v1/knowledge/wiki-fact-sets/events/e1", "GET"), false);
  assert.equal(isKnowledgeWikiReviewRoute("internal/v1/knowledge/wiki-fact-sets/events/e1"), false);
  const calls = [];
  t.mock.method(global, "fetch", async (url, init) => {
    calls.push({ url, auth: init.headers.get("Authorization"), method: init.method });
    const status = init.headers.get("Authorization") === "Bearer admin-fixture" ? 200 : 401;
    return Response.json(
      { code: status, msg: status === 200 ? "ok" : "admin required", data: {} },
      { status },
    );
  });
  async function run(route, method, cookie) {
    const segments = route.split("/");
    return bff[method](
      new NextRequest(`http://localhost/api/sea/${route}`, {
        method,
        headers: { cookie },
        ...(method === "POST" ? { body: JSON.stringify({ facts_complete: true }) } : {}),
      }),
      { params: Promise.resolve({ path: segments }) },
    );
  }
  for (const [method, route] of paths)
    assert.equal(
      (await run(route, method, "admin_center_token=admin-fixture; user_center_token=user-fixture"))
        .status,
      200,
    );
  assert.equal((await run(paths[1][1], "GET", "user_center_token=user-fixture")).status, 401);
  assert.deepEqual(
    calls.map((call) => call.auth),
    ["Bearer admin-fixture", "Bearer admin-fixture", "Bearer admin-fixture", null],
  );
  assert.ok(calls.every((call) => call.url.startsWith("http://127.0.0.1:1/v1/knowledge/")));
  assert.equal(
    (
      await run(
        "internal/v1/knowledge/wiki-fact-sets/events/e1",
        "GET",
        "admin_center_token=admin-fixture",
      )
    ).status,
    404,
  );
});

test("browser FactSet client binds scoped routes and sends only admin JWT", async (t) => {
  const oldWindow = global.window;
  const oldDocument = global.document;
  global.window = {
    localStorage: {
      getItem: (key) => (key === "admin_center_token" ? "admin-fixture" : "user-fixture"),
    },
  };
  global.document = { cookie: "admin_center_token=admin-fixture; user_center_token=user-fixture" };
  t.after(() => {
    global.window = oldWindow;
    global.document = oldDocument;
  });
  const calls = [];
  t.mock.method(global, "fetch", async (url, init) => {
    calls.push({ url, auth: new Headers(init.headers).get("Authorization"), body: init.body });
    return Response.json({ code: 200, msg: "ok", data: { fact_set_revision_id: "rev-1" } });
  });
  await knowledgeFactSets.scope("m", "p", "scope_" + "a".repeat(64));
  await knowledgeFactSets.revision("m", "p", "rev-1");
  await knowledgeFactSets.freeze("m", "p", "wiki-1", {
    source_revisions: [],
    facts: [],
    facts_complete: true,
    reason: "完整范围",
    idempotency_key: "fixture-key",
  });
  assert.deepEqual(
    calls.map((call) => call.auth),
    Array(3).fill("Bearer admin-fixture"),
  );
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "/api/sea/knowledge/modules/m/wiki-pages/p/fact-sets/scope_" + "a".repeat(64),
      "/api/sea/knowledge/modules/m/wiki-pages/p/fact-set-revisions/rev-1",
      "/api/sea/knowledge/modules/m/wiki-pages/p/revisions/wiki-1/fact-sets",
    ],
  );
  assert.equal(JSON.parse(calls[2].body).facts_complete, true);
});
