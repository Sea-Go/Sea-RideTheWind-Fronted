const assert = require("node:assert/strict");
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
  knowledge,
  knowledgeAdminRequest,
  knowledgeAnswerHistory,
  knowledgeQuality,
  knowledgeRead,
} = require("../src/features/knowledge/api.ts");
const { isKnowledgeWikiReviewRoute } = require("../src/server/knowledge-routes.ts");
const bff = require("../src/app/api/sea/[...path]/route.ts");
const { NextRequest } = require("next/server");

test("dual browser sessions send administrator JWT only for human Wiki review", async (t) => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  global.window = {
    localStorage: {
      getItem(key) {
        return key === "admin_center_token"
          ? "admin-fixture"
          : key === "user_center_token"
            ? "user-fixture"
            : null;
      },
    },
  };
  global.document = { cookie: "admin_center_token=admin-fixture; user_center_token=user-fixture" };
  t.after(() => {
    global.window = originalWindow;
    global.document = originalDocument;
  });
  const auth = [];
  t.mock.method(global, "fetch", async (_url, init) => {
    auth.push(new Headers(init.headers).get("Authorization"));
    return Response.json({ code: 200, msg: "ok", data: { revision_id: "fixed" } });
  });
  await knowledge.module("m1");
  await knowledgeRead.module("m1");
  await knowledgeRead.revision("m1", "r1");
  await knowledgeAnswerHistory.list("ordinary-session");
  await knowledgeAdminRequest("modules/m1/wiki-pages/p1/head");
  assert.deepEqual(auth, [
    "Bearer user-fixture",
    "Bearer admin-fixture",
    "Bearer admin-fixture",
    "Bearer user-fixture",
    "Bearer admin-fixture",
  ]);
});

test("missing administrator session does not silently substitute a User JWT", async (t) => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  global.window = {
    localStorage: { getItem: (key) => (key === "user_center_token" ? "user-fixture" : null) },
  };
  global.document = { cookie: "user_center_token=user-fixture" };
  t.after(() => {
    global.window = originalWindow;
    global.document = originalDocument;
  });
  t.mock.method(global, "fetch", async (_url, init) => {
    assert.equal(new Headers(init.headers).get("Authorization"), null);
    return Response.json({ code: 401, msg: "administrator required", data: null }, { status: 401 });
  });
  await assert.rejects(
    () => knowledgeAdminRequest("modules/m1/wiki-pages/p1/head"),
    /administrator required/,
  );
});

test("real Next BFF uses admin cookie for Wiki review and keeps ordinary route identity", async (t) => {
  const previousBase = process.env.SEA_PRODUCT_API_SERVER_URL;
  process.env.SEA_PRODUCT_API_SERVER_URL = "http://127.0.0.1:1";
  t.after(() => {
    if (previousBase === undefined) delete process.env.SEA_PRODUCT_API_SERVER_URL;
    else process.env.SEA_PRODUCT_API_SERVER_URL = previousBase;
  });
  assert.equal(
    isKnowledgeWikiReviewRoute("knowledge/modules/m1/wiki-pages/p1/revisions/r1/quality-judgments"),
    true,
  );
  assert.equal(isKnowledgeWikiReviewRoute("knowledge/modules/m1/revisions/r1"), false);
  assert.equal(isKnowledgeWikiReviewRoute("internal/v1/knowledge/wiki-quality/events/e1"), false);
  const seen = [];
  t.mock.method(global, "fetch", async (url, init) => {
    const auth = init.headers.get("Authorization");
    seen.push({ url, auth });
    const status =
      auth === "Bearer admin-fixture" ? 200 : auth === "Bearer user-fixture" ? 403 : 401;
    return Response.json(
      { code: status, msg: status === 200 ? "ok" : "administrator required", data: null },
      { status },
    );
  });
  async function get(path, cookie, authorization) {
    const request = new NextRequest(`http://localhost/api/sea/${path.join("/")}`, {
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
      },
    });
    return bff.GET(request, { params: Promise.resolve({ path }) });
  }
  const wikiHead = ["knowledge", "modules", "m1", "wiki-pages", "p1", "head"];
  const qualityList = [
    "knowledge",
    "modules",
    "m1",
    "wiki-pages",
    "p1",
    "revisions",
    "r1",
    "quality-judgments",
  ];
  assert.equal((await get(wikiHead, "user_center_token=user-fixture")).status, 401);
  assert.equal(
    (await get(wikiHead, "user_center_token=user-fixture; admin_center_token=admin-fixture"))
      .status,
    200,
  );
  assert.equal(
    (await get(qualityList, "user_center_token=user-fixture; admin_center_token=admin-fixture"))
      .status,
    200,
  );
  assert.equal((await get(qualityList, "", "Bearer user-fixture")).status, 403);
  assert.equal(
    (
      await get(
        ["knowledge", "modules", "m1", "revisions", "r1"],
        "user_center_token=user-fixture; admin_center_token=admin-fixture",
      )
    ).status,
    403,
  );
  assert.deepEqual(
    seen.map((item) => item.auth),
    [
      null,
      "Bearer admin-fixture",
      "Bearer admin-fixture",
      "Bearer user-fixture",
      "Bearer user-fixture",
    ],
  );
});

test("fixed RTW quality client binds one Wiki revision, admin identity and judge CAS", async (t) => {
  const originalWindow = global.window;
  const originalDocument = global.document;
  global.window = {
    localStorage: {
      getItem: (key) =>
        key === "admin_center_token"
          ? "admin-fixture"
          : key === "user_center_token"
            ? "user-fixture"
            : null,
    },
  };
  global.document = { cookie: "admin_center_token=admin-fixture; user_center_token=user-fixture" };
  t.after(() => {
    global.window = originalWindow;
    global.document = originalDocument;
  });
  const calls = [];
  t.mock.method(global, "fetch", async (url, init) => {
    calls.push({ url, init });
    return Response.json({ code: 200, msg: "ok", data: { items: [], next_cursor: "" } });
  });
  await knowledgeQuality.editingHead("module/a", "page/b");
  await knowledgeQuality.judgments("module/a", "page/b", "revision/c", "fact/next");
  await knowledgeQuality.judge("module/a", "page/b", "revision/c", {
    source_revision_id: "source-r1",
    source_content_sha256: "s".repeat(64),
    locator: "paragraph:2",
    source_quote: "原文字串",
    source_quote_sha256: "q".repeat(64),
    assessment: "undetermined",
    rubric_version: "sea.wiki.fact-coverage.v1",
    reason: "待另一份原文核对",
    base_judge_revision_id: "judge-r1",
    idempotency_key: "one-fixed-intent",
  });
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "/api/sea/knowledge/modules/module%2Fa/wiki-pages/page%2Fb/head",
      "/api/sea/knowledge/modules/module%2Fa/wiki-pages/page%2Fb/revisions/revision%2Fc/quality-judgments?limit=20&cursor=fact%2Fnext",
      "/api/sea/knowledge/modules/module%2Fa/wiki-pages/page%2Fb/revisions/revision%2Fc/quality-judgments",
    ],
  );
  assert.ok(
    calls.every(
      (call) => new Headers(call.init.headers).get("Authorization") === "Bearer admin-fixture",
    ),
  );
  const post = JSON.parse(calls[2].init.body);
  assert.equal(post.base_judge_revision_id, "judge-r1");
  assert.equal(post.grade, undefined);
  assert.equal(post.tenant_id, undefined);
});
