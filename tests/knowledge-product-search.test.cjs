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
        resolveJsonModule: true,
      },
    }).outputText,
    filename,
  );

const {
  clearSearchOperation,
  knowledgeProductSearch,
  loadSearchOperation,
  newSearchOperation,
  saveSearchOperation,
  SearchKeyConflict,
} = require("../src/features/knowledge/product-search.ts");
const { isKnowledgeRoute } = require("../src/server/knowledge-routes.ts");
const bff = require("../src/app/api/sea/[...path]/route.ts");
const { NextRequest } = require("next/server");

const input = {
  module_id: "book-1",
  query: "潮汐怎样变化？",
  depth: "fast",
  intelligence: "medium",
};
const pending = {
  search_id: "search-1",
  answer_id: "answer-1",
  status: "retryable_failure",
  citations: [],
};

function browser(t) {
  const values = new Map([["user_center_token", "user-jwt"]]);
  const saved = new Map();
  const previous = {
    window: global.window,
    document: global.document,
    sessionStorage: global.sessionStorage,
  };
  global.window = { localStorage: { getItem: (key) => values.get(key) || null } };
  global.document = { cookie: "" };
  global.sessionStorage = {
    getItem: (key) => saved.get(key) || null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  };
  t.after(() => Object.assign(global, previous));
  return { values, saved };
}

test("browser sends exactly five product fields and retains 503 operation identity", async (t) => {
  browser(t);
  const operation = newSearchOperation({ ...input, query: ` ${input.query} ` });
  operation.input.subject_ref = { authority_id: "forged" };
  const calls = [];
  t.mock.method(global, "fetch", async (url, init) => {
    calls.push({
      url,
      method: init.method,
      body: JSON.parse(init.body),
      auth: init.headers.get("Authorization"),
    });
    return Response.json({ code: 503, msg: "unavailable", data: pending }, { status: 503 });
  });
  const response = await knowledgeProductSearch.create("session/a", operation);
  assert.equal(response.httpStatus, 503);
  assert.equal(response.result.search_id, "search-1");
  assert.deepEqual(calls, [
    {
      url: "/api/sea/knowledge/answer-sessions/session%2Fa/searches",
      method: "POST",
      body: { ...input, idempotency_key: operation.idempotencyKey },
      auth: "Bearer user-jwt",
    },
  ]);
  assert.match(operation.idempotencyKey, /^[A-Za-z0-9_.-]{8,128}$/);
});

test("fixed GET preserves in-flight, retryable, and accepted terminal states", async (t) => {
  browser(t);
  const returned = [
    { http: 202, data: { ...pending, status: "in_flight" } },
    { http: 200, data: pending },
    { http: 200, data: { ...pending, status: "insufficient" } },
  ];
  const calls = [];
  t.mock.method(global, "fetch", async (url, init) => {
    calls.push({ url, method: init.method });
    const next = returned.shift();
    return Response.json(
      { code: next.http, msg: "status", data: next.data },
      { status: next.http },
    );
  });
  const results = [];
  for (let i = 0; i < 3; i++)
    results.push(await knowledgeProductSearch.get("session/a", "search/1"));
  assert.deepEqual(
    results.map((result) => result.result.status),
    ["in_flight", "retryable_failure", "insufficient"],
  );
  assert.deepEqual(
    calls,
    Array(3).fill({
      url: "/api/sea/knowledge/answer-sessions/session%2Fa/searches/search%2F1",
      method: "GET",
    }),
  );
});

test("409 stops same-key retry, while invalid success never enters answer history", async (t) => {
  browser(t);
  const operation = newSearchOperation(input);
  const conflict = t.mock.method(global, "fetch", async () =>
    Response.json({ code: 409, msg: "conflict", data: null }, { status: 409 }),
  );
  await assert.rejects(knowledgeProductSearch.create("session-1", operation), SearchKeyConflict);
  conflict.mock.restore();
  t.mock.method(global, "fetch", async () =>
    Response.json({
      code: 200,
      msg: "success",
      data: { ...pending, status: "succeeded", answer: "伪答案" },
    }),
  );
  await assert.rejects(
    knowledgeProductSearch.create("session-1", operation),
    /状态与已接纳结果不一致/,
  );
});

test("accepted 200 keeps RTW answer ID for the existing fixed history detail", async (t) => {
  browser(t);
  const operation = newSearchOperation(input);
  t.mock.method(global, "fetch", async () =>
    Response.json({
      code: 200,
      msg: "success",
      data: {
        ...pending,
        status: "succeeded",
        answer: "潮汐具有周期变化。",
        citations: [{ evidence_id: "evidence-1" }],
      },
    }),
  );
  const result = await knowledgeProductSearch.create("session-1", operation);
  assert.equal(result.result.answer_id, "answer-1");
  assert.equal(result.result.search_id, "search-1");
  assert.equal(result.result.status, "succeeded");
});

test("session recovery keeps the same key and binds it to current user token", async (t) => {
  const { saved } = browser(t);
  const operation = newSearchOperation(input);
  await saveSearchOperation("session-1", "token-a", operation);
  assert.deepEqual(await loadSearchOperation("session-1", "token-a"), operation);
  assert.equal(await loadSearchOperation("session-1", "token-b"), null);
  assert.equal([...saved.values()][0].includes("token-a"), false);
  clearSearchOperation("session-1");
  assert.equal(await loadSearchOperation("session-1", "token-a"), null);
});

test("generated BFF routes relay product POST/GET status and only user JWT", async (t) => {
  assert.equal(isKnowledgeRoute("knowledge/answer-sessions/session-1/searches", "POST"), true);
  assert.equal(
    isKnowledgeRoute("knowledge/answer-sessions/session-1/searches/search-1", "GET"),
    true,
  );
  assert.equal(isKnowledgeRoute("knowledge/answer-sessions/session-1/searches", "GET"), false);
  process.env.SEA_PRODUCT_API_SERVER_URL = "http://127.0.0.1:1";
  t.after(() => delete process.env.SEA_PRODUCT_API_SERVER_URL);
  const seen = [];
  t.mock.method(global, "fetch", async (url, init) => {
    seen.push({
      url,
      auth: init.headers.get("Authorization"),
      method: init.method,
      body: init.body,
    });
    return Response.json({ code: 503, msg: "retry", data: pending }, { status: 503 });
  });
  const routePath = ["knowledge", "answer-sessions", "session-1", "searches"];
  const request = new NextRequest(
    "http://localhost/api/sea/knowledge/answer-sessions/session-1/searches",
    {
      method: "POST",
      headers: { authorization: "Bearer user-jwt", cookie: "admin_center_token=admin-only" },
      body: JSON.stringify({ ...input, idempotency_key: "original-key" }),
    },
  );
  const response = await bff.POST(request, { params: Promise.resolve({ path: routePath }) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).data.search_id, "search-1");
  assert.deepEqual(seen[0], {
    url: "http://127.0.0.1:1/v1/knowledge/answer-sessions/session-1/searches",
    auth: "Bearer user-jwt",
    method: "POST",
    body: JSON.stringify({ ...input, idempotency_key: "original-key" }),
  });
  const get = await bff.GET(
    new NextRequest(
      "http://localhost/api/sea/knowledge/answer-sessions/session-1/searches/search-1",
      {
        headers: { cookie: "admin_center_token=admin-only" },
      },
    ),
    { params: Promise.resolve({ path: [...routePath, "search-1"] }) },
  );
  assert.equal(get.status, 503);
  assert.equal(seen[1].auth, null);
});
