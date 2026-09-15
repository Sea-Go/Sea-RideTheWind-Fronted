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
const {
  appendAcceptedPage,
  readCurrentCitationStates,
  readHistoricalAnswer,
  readHistoricalPage,
} = require("../src/features/knowledge/answer-history.ts");
const { isKnowledgeRoute } = require("../src/server/knowledge-routes.ts");
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
});
