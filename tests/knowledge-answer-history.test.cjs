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

const { knowledgeAnswerHistory } = require("../src/features/knowledge/api.ts");
const { parseStrictJSON } = require("../src/services/strict-json.ts");
const {
  appendAcceptedPage,
  readCurrentCitationStates,
  readHistoricalAnswer,
  readHistoricalPage,
} = require("../src/features/knowledge/answer-history.ts");
const { isKnowledgeRoute } = require("../src/server/knowledge-routes.ts");
const v2Routes = require("../src/features/knowledge/generated/routes-v2-history.json");
const v2Source = require("../src/features/knowledge/generated/source-v2-history.json");
const route = require("../src/app/api/sea/[...path]/route.ts");
const { NextRequest } = require("next/server");

function answer(status = "succeeded") {
  const turn = {
    request: {
      SearchID: "search-1",
      AnswerID: "answer-1",
      Subject: { authority_id: "rtw.identity", tenant_id: "platform", subject_id: "42" },
      SessionID: "session-1",
      Search: { Query: "古籍中怎样描述潮汐？" },
    },
    result: {
      answer_id: "answer-1",
      summary_status: status,
      answer: status === "succeeded" ? "记载了周期变化。" : "",
      citations: status === "succeeded" ? ["evidence-1"] : [],
      search: {
        evidence_pack: {
          search_id: "search-1",
          snapshot: { module_id: "book-1", release_id: "release-1", publication_revision: "3" },
          evidence:
            status === "succeeded"
              ? [
                  {
                    evidence_id: "evidence-1",
                    quote: "潮汐有定时",
                    key: {
                      source_kind: "source",
                      content_id: "source-1",
                      revision_id: "revision-1",
                    },
                    locator: { locator: "paragraph:2" },
                    quote_hash: "historic-quote-hash",
                    original: { key: "book-object", sha256: "object-hash" },
                  },
                ]
              : [],
        },
      },
    },
  };
  return {
    answer_id: "answer-1",
    search_id: "search-1",
    subject: { authority_id: "rtw.identity", tenant_id: "platform", subject_id: "42" },
    session_id: "session-1",
    status,
    accepted_ordinal: 1,
    accepted_at: "2026-09-14T11:00:00Z",
    turn_json: JSON.stringify(turn),
  };
}

test("generated product history routes are read-only and worker routes stay unavailable", () => {
  assert.deepEqual(v2Routes, [
    { method: "GET", path: "knowledge/answer-sessions/{session_id}/accepted-answers" },
    { method: "GET", path: "knowledge/answer-sessions/{session_id}/accepted-answers/{answer_id}" },
    {
      method: "GET",
      path: "knowledge/answer-sessions/{session_id}/accepted-answers/{answer_id}/citations",
    },
  ]);
  assert.equal(v2Source.provider_commit, "bedaa02d0fa587a5e9f798b8ff9f42c800f98e3e");
  assert.equal(
    v2Source.api_sha256,
    "0cc506d50784348ab2ed4a4012bb5182f25a0e3e5ae65b4690d67536325b91a9",
  );
  assert.equal(
    v2Source.components_sha256,
    "4c939cd48f13622730563e137420db5564dceebacca27ee1951ed88b488f2581",
  );
  assert.equal(
    isKnowledgeRoute("knowledge/answer-sessions/session-1/accepted-answers", "GET"),
    true,
  );
  assert.equal(
    isKnowledgeRoute("knowledge/answer-sessions/session-1/accepted-answers/answer-1", "GET"),
    true,
  );
  assert.equal(
    isKnowledgeRoute(
      "knowledge/answer-sessions/session-1/accepted-answers/answer-1/citations",
      "GET",
    ),
    true,
  );
  assert.equal(
    isKnowledgeRoute("knowledge/answer-sessions/session-1/accepted-answers", "POST"),
    false,
  );
  assert.equal(isKnowledgeRoute("internal/v1/knowledge/accepted-answers", "GET"), false);
});

test("history client sends session, cursor and answer only", async (t) => {
  const urls = [];
  t.mock.method(global, "fetch", async (url) => {
    urls.push(url);
    return Response.json({ code: 200, msg: "success", data: { items: [] } });
  });
  await knowledgeAnswerHistory.list("session/a", 4);
  await knowledgeAnswerHistory.answer("session/a", "answer/b");
  await knowledgeAnswerHistory.citationStates("session/a", "answer/b");
  assert.deepEqual(urls, [
    "/api/sea/knowledge/answer-sessions/session%2Fa/accepted-answers?limit=20&after_ordinal=4",
    "/api/sea/knowledge/answer-sessions/session%2Fa/accepted-answers/answer%2Fb",
    "/api/sea/knowledge/answer-sessions/session%2Fa/accepted-answers/answer%2Fb/citations",
  ]);
});

test("accepted turn shows its fixed historic citation without inferring current availability", () => {
  const view = readHistoricalAnswer(answer(), "session-1");
  assert.equal(view.ordinal, 1);
  assert.equal(view.question, "古籍中怎样描述潮汐？");
  assert.equal(view.status, "succeeded");
  assert.deepEqual(view.citations, [
    {
      id: "evidence-1",
      quote: "潮汐有定时",
      location: "paragraph:2",
      sourceHref:
        "/knowledge/book-1/sources?release=release-1&revision=revision-1&locator=paragraph%3A2",
      sourceKind: "source",
      contentId: "source-1",
      revisionId: "revision-1",
      quoteHash: "historic-quote-hash",
      originalKey: "book-object",
      originalSha256: "object-hash",
    },
  ]);
  assert.deepEqual(readHistoricalAnswer(answer("insufficient"), "session-1").citations, []);
  assert.throws(() => readHistoricalAnswer(answer(), "other-session"));
  const forged = answer();
  const turn = JSON.parse(forged.turn_json);
  turn.result.citations = ["missing-evidence"];
  forged.turn_json = JSON.stringify(turn);
  assert.throws(() => readHistoricalAnswer(forged, "session-1"));
  for (const edit of [
    (row) => {
      row.request.SearchID = "other-search";
    },
    (row) => {
      row.result.search.evidence_pack.search_id = "other-search";
    },
    (row) => {
      row.request.Subject.subject_id = "other-user";
    },
  ]) {
    const mismatched = answer();
    const raw = JSON.parse(mismatched.turn_json);
    edit(raw);
    mismatched.turn_json = JSON.stringify(raw);
    assert.throws(() => readHistoricalAnswer(mismatched, "session-1"));
  }
});

test("mixed v1 and v2 accepted subjects keep the same verified RTW UID and immutable turn", () => {
  const v1 = answer();
  const v2 = { issuer: "rtw.identity", subject_id: "42" };
  const turn = JSON.parse(v1.turn_json);
  turn.request.Subject = v2;
  assert.deepEqual(
    readHistoricalAnswer({ ...v1, subject: v2, turn_json: JSON.stringify(turn) }, "session-1"),
    readHistoricalAnswer(v1, "session-1"),
  );
  assert.deepEqual(
    readHistoricalAnswer({ ...v1, subject: v2 }, "session-1"),
    readHistoricalAnswer(v1, "session-1"),
  );
  assert.deepEqual(
    readHistoricalAnswer({ ...v1, turn_json: JSON.stringify(turn) }, "session-1"),
    readHistoricalAnswer(v1, "session-1"),
  );
  const highUID = "9223372036854775807";
  assert.equal(
    readHistoricalAnswer(
      {
        ...v1,
        subject: { ...v2, subject_id: highUID },
        turn_json: v1.turn_json.replace('"subject_id":"42"', `"subject_id":"${highUID}"`),
      },
      "session-1",
    ).answerId,
    "answer-1",
  );
  assert.equal(v1.turn_json, answer().turn_json);
});

test("a v1/v2 mixed page retains valid answers and isolates a conflicting row", () => {
  const first = answer();
  const second = {
    ...answer(),
    answer_id: "answer-2",
    search_id: "search-2",
    accepted_ordinal: 2,
    subject: { issuer: "rtw.identity", subject_id: "42" },
  };
  const turn = JSON.parse(second.turn_json);
  turn.request.AnswerID = second.answer_id;
  turn.request.SearchID = second.search_id;
  turn.result.answer_id = second.answer_id;
  turn.result.search.evidence_pack.search_id = second.search_id;
  second.turn_json = JSON.stringify(turn); // RTW v2 projection over an unchanged v1 turn.
  const conflicting = {
    ...second,
    answer_id: "answer-3",
    accepted_ordinal: 3,
    subject: { issuer: "rtw.identity", subject_id: "43" },
  };
  conflicting.turn_json = second.turn_json
    .replace('"AnswerID":"answer-2"', '"AnswerID":"answer-3"')
    .replace('"answer_id":"answer-2"', '"answer_id":"answer-3"');
  const items = appendAcceptedPage([], { items: [first, second, conflicting] });
  const page = readHistoricalPage(items, "session-1");
  assert.deepEqual(
    page.answers.map((row) => row.answerId),
    ["answer-1", "answer-2"],
  );
  assert.equal(page.unreadableCount, 1);
  assert.throws(() => readHistoricalAnswer(conflicting, "session-1"));
});

test("history rejects unknown or injected subject fields and never joins another UID", () => {
  for (const bad of [
    { authority_id: "wrong", tenant_id: "platform", subject_id: "42" },
    { authority_id: "rtw.identity", tenant_id: "another", subject_id: "42" },
    { issuer: "wrong", subject_id: "42" },
    { issuer: "rtw.identity", tenant_id: "platform", subject_id: "42" },
    { issuer: "rtw.identity", authority_id: "rtw.identity", subject_id: "42" },
    ...["", "0", "-1", "01", "1.0", "other", "9223372036854775808"].map((subject_id) => ({
      issuer: "rtw.identity",
      subject_id,
    })),
  ]) {
    assert.throws(() => readHistoricalAnswer({ ...answer(), subject: bad }, "session-1"));
  }
  assert.throws(() =>
    readHistoricalAnswer(
      { ...answer(), subject: { issuer: "rtw.identity", subject_id: "43" } },
      "session-1",
    ),
  );
  const row = answer();
  const turn = JSON.parse(row.turn_json);
  turn.request.Subject = { issuer: "rtw.identity", subject_id: "43" };
  assert.throws(() =>
    readHistoricalAnswer({ ...row, turn_json: JSON.stringify(turn) }, "session-1"),
  );
});

test("accepted response and immutable turn reject duplicate object keys before normalization", async (t) => {
  assert.throws(() =>
    parseStrictJSON(
      '{"subject":{"issuer":"rtw.identity","\\u0069ssuer":"wrong","subject_id":"42"}}',
    ),
  );
  assert.throws(() =>
    parseStrictJSON('{"items":[{"subject":{"subject_id":"42","subject_id":"43"}}]}'),
  );
  assert.deepEqual(
    parseStrictJSON('{"items":[{"subject":{"issuer":"rtw.identity","subject_id":"42"}}]}'),
    { items: [{ subject: { issuer: "rtw.identity", subject_id: "42" } }] },
  );
  const row = answer();
  row.turn_json = row.turn_json.replace('"subject_id":"42"', '"subject_id":"42","subject_id":"43"');
  assert.throws(() => readHistoricalAnswer(row, "session-1"));

  t.mock.method(
    global,
    "fetch",
    async () =>
      new Response('{"code":200,"msg":"ok","data":{"items":[],"items":[]}}', { status: 200 }),
  );
  await assert.rejects(() => knowledgeAnswerHistory.list("session-1"), /重复字段/);
  await assert.rejects(() => knowledgeAnswerHistory.answer("session-1", "answer-1"), /重复字段/);
});

test("current product citation projection decides availability without trusting old quote", () => {
  const historical = readHistoricalAnswer(answer(), "session-1");
  const current = {
    answer_id: "answer-1",
    search_id: "search-1",
    status: "succeeded",
    module_id: "book-1",
    release_id: "release-1",
    publication_revision: "3",
    citations: [
      {
        evidence_id: "evidence-1",
        source_kind: "source",
        content_id: "source-1",
        revision_id: "revision-1",
        locator: { locator: "paragraph:2" },
        quote_hash: "historic-quote-hash",
        original: { key: "book-object", sha256: "object-hash" },
        state: "unavailable",
      },
    ],
  };
  assert.equal(readCurrentCitationStates(historical, current).get("evidence-1"), "unavailable");
  assert.throws(() => readCurrentCitationStates(historical, { ...current, search_id: "other" }));
  assert.throws(() =>
    readCurrentCitationStates(historical, {
      ...current,
      citations: [{ ...current.citations[0], revision_id: "newer-revision", state: "available" }],
    }),
  );
  for (const changed of [
    { publication_revision: "4" },
    { citations: [{ ...current.citations[0], content_id: "wrong-content", state: "available" }] },
    { citations: [{ ...current.citations[0], quote_hash: "wrong-quote", state: "available" }] },
  ])
    assert.throws(() => readCurrentCitationStates(historical, { ...current, ...changed }));
});

test("accepted ordinal pages append in order without duplicating replayed records", () => {
  const first = answer();
  const second = { ...answer(), answer_id: "answer-2", accepted_ordinal: 2 };
  assert.deepEqual(appendAcceptedPage([second], { items: [first, second] }), [first, second]);
});

test("one unreadable historical turn does not hide a later valid answer", () => {
  const older = answer();
  older.answer_id = "legacy-answer";
  older.accepted_ordinal = 1;
  older.turn_json = JSON.stringify({ Request: { AnswerID: "legacy-answer" } });
  const current = answer();
  current.answer_id = "answer-2";
  current.search_id = "search-2";
  current.accepted_ordinal = 2;
  const turn = JSON.parse(current.turn_json);
  turn.request.AnswerID = current.answer_id;
  turn.request.SearchID = current.search_id;
  turn.result.answer_id = current.answer_id;
  turn.result.search.evidence_pack.search_id = current.search_id;
  current.turn_json = JSON.stringify(turn);
  const page = readHistoricalPage([older, current], "session-1");
  assert.equal(page.unreadableCount, 1);
  assert.deepEqual(
    page.answers.map((row) => row.answerId),
    ["answer-2"],
  );
  assert.throws(() => readHistoricalAnswer(older, "session-1"));
});

test("BFF preserves user JWT and status while excluding admin cookie on product history", async (t) => {
  process.env.SEA_PRODUCT_API_SERVER_URL = "http://127.0.0.1:1";
  t.after(() => delete process.env.SEA_PRODUCT_API_SERVER_URL);
  const seen = [];
  t.mock.method(global, "fetch", async (url, init) => {
    seen.push({ url, authorization: init.headers.get("Authorization") });
    return Response.json({ code: 401, msg: "invalid user JWT", data: null }, { status: 401 });
  });
  const path = ["knowledge", "answer-sessions", "session-1", "accepted-answers"];
  const noUser = await route.GET(
    new NextRequest(
      "http://localhost/api/sea/knowledge/answer-sessions/session-1/accepted-answers",
      {
        headers: { cookie: "admin_center_token=admin-only" },
      },
    ),
    { params: Promise.resolve({ path }) },
  );
  assert.equal(noUser.status, 401);
  assert.equal(seen[0].authorization, null);
  const withUser = await route.GET(
    new NextRequest(
      "http://localhost/api/sea/knowledge/answer-sessions/session-1/accepted-answers",
      {
        headers: { authorization: "Bearer user-jwt", cookie: "admin_center_token=admin-only" },
      },
    ),
    { params: Promise.resolve({ path }) },
  );
  assert.equal(withUser.status, 401);
  assert.equal(seen[1].authorization, "Bearer user-jwt");
  assert.equal(
    seen[1].url,
    "http://127.0.0.1:1/v1/knowledge/answer-sessions/session-1/accepted-answers",
  );
  const clientVersion = await route.GET(
    new NextRequest(
      "http://localhost/api/sea/knowledge/answer-sessions/session-1/accepted-answers?version=v2",
      { headers: { authorization: "Bearer user-jwt" } },
    ),
    { params: Promise.resolve({ path }) },
  );
  assert.equal(clientVersion.status, 400);
  assert.equal(seen.length, 2);
});

test("v2 history switch is server controlled, GET only, and forwards only User JWT", async (t) => {
  process.env.SEA_PRODUCT_API_SERVER_URL = "http://127.0.0.1:1";
  process.env.SEA_KNOWLEDGE_HISTORY_READ_VERSION = "v2";
  t.after(() => {
    delete process.env.SEA_PRODUCT_API_SERVER_URL;
    delete process.env.SEA_KNOWLEDGE_HISTORY_READ_VERSION;
  });
  const seen = [];
  t.mock.method(global, "fetch", async (url, init) => {
    seen.push({ url, method: init.method, authorization: init.headers.get("Authorization") });
    const status = url.includes("missing-answer") ? 404 : 401;
    return Response.json({ code: status, msg: "upstream", data: null }, { status });
  });
  const base = "http://localhost/api/sea/knowledge/answer-sessions/session-1/accepted-answers";
  const list = ["knowledge", "answer-sessions", "session-1", "accepted-answers"];
  const withoutUser = await route.GET(
    new NextRequest(base, { headers: { cookie: "admin_center_token=admin-only" } }),
    { params: Promise.resolve({ path: list }) },
  );
  assert.equal(withoutUser.status, 401);
  assert.equal(seen.length, 0);
  const withUser = (url, path) =>
    route.GET(
      new NextRequest(url, {
        headers: { authorization: "Bearer user-jwt", cookie: "admin_center_token=admin-only" },
      }),
      { params: Promise.resolve({ path }) },
    );
  assert.equal((await withUser(`${base}?limit=20&after_ordinal=4`, list)).status, 401);
  const detail = [...list, "missing-answer"];
  assert.equal((await withUser(`${base}/missing-answer`, detail)).status, 404);
  const citations = [...detail, "citations"];
  assert.equal((await withUser(`${base}/missing-answer/citations`, citations)).status, 404);
  assert.deepEqual(seen, [
    {
      url: "http://127.0.0.1:1/v2/knowledge/answer-sessions/session-1/accepted-answers?limit=20&after_ordinal=4",
      method: "GET",
      authorization: "Bearer user-jwt",
    },
    {
      url: "http://127.0.0.1:1/v2/knowledge/answer-sessions/session-1/accepted-answers/missing-answer",
      method: "GET",
      authorization: "Bearer user-jwt",
    },
    {
      url: "http://127.0.0.1:1/v2/knowledge/answer-sessions/session-1/accepted-answers/missing-answer/citations",
      method: "GET",
      authorization: "Bearer user-jwt",
    },
  ]);
  assert.equal((await withUser(`${base}?subject_id=43`, list)).status, 400);
  assert.equal((await withUser(`${base}?limit=20&limit=30`, list)).status, 400);
  assert.equal((await withUser(`${base}/missing-answer?after_ordinal=4`, detail)).status, 400);
  assert.equal(
    (
      await route.POST(
        new NextRequest(base, { method: "POST", headers: { authorization: "Bearer user-jwt" } }),
        { params: Promise.resolve({ path: list }) },
      )
    ).status,
    404,
  );
  assert.equal(
    (await withUser("http://localhost/api/sea/knowledge/modules", ["knowledge", "modules"])).status,
    401,
  );
  assert.equal(seen.at(-1).url, "http://127.0.0.1:1/v1/knowledge/modules");
  assert.equal(
    (
      await withUser("http://localhost/api/sea/knowledge/accepted-answers", [
        "knowledge",
        "accepted-answers",
      ])
    ).status,
    404,
  );
});

test("v2 BFF preserves the immutable v1 turn while strict reader rejects cross UID and duplicate keys", async (t) => {
  process.env.SEA_PRODUCT_API_SERVER_URL = "http://127.0.0.1:1";
  process.env.SEA_KNOWLEDGE_HISTORY_READ_VERSION = "v2";
  t.after(() => {
    delete process.env.SEA_PRODUCT_API_SERVER_URL;
    delete process.env.SEA_KNOWLEDGE_HISTORY_READ_VERSION;
  });
  const original = answer();
  const projected = { ...original, subject: { issuer: "rtw.identity", subject_id: "42" } };
  const path = ["knowledge", "answer-sessions", "session-1", "accepted-answers", "answer-1"];
  const request = () =>
    new NextRequest(
      "http://localhost/api/sea/knowledge/answer-sessions/session-1/accepted-answers/answer-1",
      { headers: { authorization: "Bearer user-jwt" } },
    );
  let body = JSON.stringify({ code: 200, msg: "ok", data: projected });
  t.mock.method(global, "fetch", async () => new Response(body, { status: 200 }));
  const response = await route.GET(request(), { params: Promise.resolve({ path }) });
  assert.equal(response.status, 200);
  const decoded = parseStrictJSON(await response.text());
  assert.equal(decoded.data.turn_json, original.turn_json);
  assert.deepEqual(
    readHistoricalAnswer(decoded.data, "session-1"),
    readHistoricalAnswer(original, "session-1"),
  );
  body = JSON.stringify({
    code: 200,
    msg: "ok",
    data: { ...projected, subject: { issuer: "rtw.identity", subject_id: "43" } },
  });
  const conflictingResponse = await route.GET(request(), { params: Promise.resolve({ path }) });
  const conflicting = parseStrictJSON(await conflictingResponse.text());
  assert.throws(() => readHistoricalAnswer(conflicting.data, "session-1"));
  body =
    '{"code":200,"msg":"ok","data":{"subject":{"issuer":"rtw.identity","subject_id":"42","subject_id":"43"}}}';
  const duplicateResponse = await route.GET(request(), { params: Promise.resolve({ path }) });
  const duplicateBody = await duplicateResponse.text();
  assert.throws(() => parseStrictJSON(duplicateBody), /重复字段/);
});

test("invalid server history version fails clearly instead of silently using v1", async (t) => {
  process.env.SEA_KNOWLEDGE_HISTORY_READ_VERSION = "v3";
  t.after(() => delete process.env.SEA_KNOWLEDGE_HISTORY_READ_VERSION);
  t.mock.method(global, "fetch", async () => assert.fail("invalid version must not fetch"));
  const path = ["knowledge", "answer-sessions", "session-1", "accepted-answers"];
  const response = await route.GET(
    new NextRequest(
      "http://localhost/api/sea/knowledge/answer-sessions/session-1/accepted-answers",
    ),
    { params: Promise.resolve({ path }) },
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).msg, /仅支持 v1 或 v2/);
});
