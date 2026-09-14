const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

// Execute the actual TypeScript modules with the project's existing compiler.
const root = path.resolve(__dirname, "..");
const resolveFilename = Module._resolveFilename;
const previousTsLoader = require.extensions[".ts"];
Module._resolveFilename = function (name, ...args) {
  return resolveFilename.call(
    this,
    name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name,
    ...args,
  );
};
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
const {
  activateKnowledge,
  communityPage,
  readEventStream,
  suggest,
} = require("../src/features/sea/data/api.ts");
const { createProxyHandler } = require("../src/app/api/_shared/proxy.ts");
const productRoute = require("../src/app/api/sea/[...path]/route.ts");
const { NextRequest } = require("next/server");
Module._resolveFilename = resolveFilename;
if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
else delete require.extensions[".ts"];

const envelope = (data) => Response.json({ code: 200, msg: "ok", data });

test("community and title suggestions consume the existing response envelopes", async (t) => {
  const requests = [];
  t.mock.method(global, "fetch", async (url, init) => {
    requests.push({ url, init });
    return url.includes("search/title")
      ? envelope({ items: [{ title: "海洋环流" }] })
      : envelope({
          articles: [{ article_id: "ocean-42", title: "海洋与气候", like_count: 3, status: 2 }],
        });
  });
  const signal = new AbortController().signal;
  const feed = await communityPage(2, signal);
  assert.equal(feed.items[0].id, "ocean-42");
  assert.equal(feed.items[0].likes, 3);
  assert.equal(feed.hasMore, false);
  assert.match(requests[0].url, /page=2&page_size=8/);
  assert.equal(requests[0].init.signal, signal);
  assert.equal((await suggest("海洋", signal)).items[0].title, "海洋环流");
  assert.deepEqual(Object.keys(JSON.parse(requests[1].init.body)).sort(), [
    "query",
    "search_request_id",
    "topk",
  ]);
});

test("public community feed keeps stable article IDs and hides non-published states", async (t) => {
  t.mock.method(global, "fetch", async () =>
    envelope({
      articles: [
        { id: "article-1", title: "已发布", status: 2 },
        { id: "article-2", title: "待审核", status: 3 },
        { id: "article-3", title: "已撤回", status: 1 },
        { id: "article-4", title: "已拒绝", status: 4 },
      ],
      total: 4,
    }),
  );
  const feed = await communityPage(1, new AbortController().signal);
  assert.deepEqual(
    feed.items.map((item) => item.id),
    ["article-1"],
  );
  assert.equal(feed.hasMore, false);
});

test("community pagination follows upstream rows even when a full page is under review", async (t) => {
  t.mock.method(global, "fetch", async () =>
    envelope({
      articles: Array.from({ length: 8 }, (_, index) => ({
        id: `reviewing-${index}`,
        status: 3,
      })),
      total: 9,
    }),
  );
  const feed = await communityPage(1, new AbortController().signal);
  assert.deepEqual(feed.items, []);
  assert.equal(feed.hasMore, true);
});

test("activation binds the supplied module and expected pointer revision", async (t) => {
  const state = {
    active_release_id: "old",
    candidate_release_id: "new",
    build_id: "build-9",
    pointer_revision: 7,
  };
  t.mock.method(global, "fetch", async (url, init) => {
    assert.equal(url, "/api/sea/knowledge/modules/ocean%20currents/activation");
    assert.equal(init.method, "PUT");
    assert.deepEqual(JSON.parse(init.body), {
      release_id: "new",
      build_id: "build-9",
      expected_pointer_revision: 7,
      reason: "核对完成",
    });
    return envelope({ ...state, active_release_id: "new", pointer_revision: 8 });
  });
  assert.equal((await activateKnowledge("ocean currents", state, "核对完成")).pointer_revision, 8);
});

test(
  "SSE emits before EOF and preserves split UTF-8, CRLF and final events",
  { timeout: 1500 },
  async () => {
    let stream;
    const events = [];
    let received;
    const first = new Promise((resolve) => {
      received = resolve;
    });
    const response = new Response(
      new ReadableStream({
        start(controller) {
          stream = controller;
        },
      }),
    );
    const reading = readEventStream(
      response,
      (event) => {
        events.push(event);
        received();
      },
      new AbortController().signal,
    );
    const bytes = new TextEncoder().encode(
      'data: {"type":"answer.delta","delta":"银河🌌"}\r\n\r\n',
    );
    for (const byte of bytes) stream.enqueue(Uint8Array.of(byte));
    await first;
    assert.equal(events[0].delta, "银河🌌");
    stream.enqueue(
      new TextEncoder().encode('data: {"type":"answer.completed","status":"complete"}'),
    );
    stream.close();
    await reading;
    assert.equal(events[1].type, "answer.completed");
  },
);

test(
  "stopping an idle SSE reader cancels its body without waiting for another chunk",
  { timeout: 1500 },
  async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
    );
    const controller = new AbortController();
    const reading = readEventStream(
      response,
      () => assert.fail("unexpected event"),
      controller.signal,
    );
    controller.abort();
    await assert.rejects(reading, { name: "AbortError" });
    assert.equal(cancelled, true);
  },
);

test(
  "the existing BFF forwards streams and the request abort signal without buffering",
  { timeout: 1500 },
  async (t) => {
    let stream;
    const request = new NextRequest("http://localhost/api/article/v1/events");
    t.mock.method(global, "fetch", async (_url, init) => {
      assert.equal(init.signal, request.signal);
      return new Response(
        new ReadableStream({
          start(controller) {
            stream = controller;
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    });
    process.env.SEA_TEST_UPSTREAM = "http://127.0.0.1:1";
    t.after(() => delete process.env.SEA_TEST_UPSTREAM);
    const handler = createProxyHandler({
      envVarName: "SEA_TEST_UPSTREAM",
      proxyName: "test",
      unavailableMessage: "unavailable",
      resolveUpstreamPath: () => "/v1/events",
    });
    const response = await handler(request, {
      params: Promise.resolve({ path: ["v1", "events"] }),
    });
    assert.equal(response.headers.get("X-Accel-Buffering"), "no");
    stream.enqueue(new TextEncoder().encode("data: first\n\n"));
    const reader = response.body.getReader();
    assert.equal(new TextDecoder().decode((await reader.read()).value), "data: first\n\n");
    stream.close();
    assert.equal((await reader.read()).done, true);
  },
);

test("unconfigured product APIs return unavailable and never synthesize fixtures", async (t) => {
  const original = process.env.SEA_PRODUCT_API_SERVER_URL;
  delete process.env.SEA_PRODUCT_API_SERVER_URL;
  t.after(() => {
    if (original === undefined) delete process.env.SEA_PRODUCT_API_SERVER_URL;
    else process.env.SEA_PRODUCT_API_SERVER_URL = original;
  });
  t.mock.method(global, "fetch", async () => assert.fail("unconfigured API must not fetch"));
  const request = new NextRequest("http://localhost/api/sea/knowledge/modules");
  const response = await productRoute.GET(request, {
    params: Promise.resolve({ path: ["knowledge", "modules"] }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).data, null);
  const unknown = await productRoute.GET(request, {
    params: Promise.resolve({ path: ["unknown"] }),
  });
  assert.equal(unknown.status, 404);
});

// Minimal hook scheduling only; handlers, message updates and SSE parsing execute production code.
function renderLearningPage(t) {
  const slots = [];
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
  const filename = path.join(root, "src/features/sea/pages/LearnPage.tsx");
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: hooks,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "../components/icons": new Proxy({}, { get: (_target, name) => name }),
    "../components/primitives": { Notice: "Notice", SeaLink: "SeaLink" },
    "../components/SeaShell": { useSea: () => ({ demo: false }) },
    "../data/demo": { citations: [] },
    "../data/api": require("../src/features/sea/data/api.ts"),
  };
  new Function("require", "module", "exports", outputText)(
    (name) => {
      assert.ok(name in modules, `unexpected page dependency: ${name}`);
      return modules[name];
    },
    module,
    module.exports,
  );
  for (const name of ["requestAnimationFrame", "cancelAnimationFrame"]) {
    const previous = global[name];
    global[name] = () => 1;
    t.after(() => {
      if (previous === undefined) delete global[name];
      else global[name] = previous;
    });
  }
  const render = () => {
    cursor = 0;
    return module.exports.LearnPage();
  };
  const nodes = (node) => {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  };
  const text = (node) => {
    if (Array.isArray(node)) return node.map(text).join("");
    if (node === null || node === undefined || typeof node === "boolean") return "";
    return typeof node === "object" ? text(node.props?.children) : String(node);
  };
  return {
    find: (predicate) => nodes(render()).find(predicate),
    text: () => text(render()),
    nodeText: text,
  };
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));
const eventBytes = (event) => new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);

for (const terminal of ["answer.completed", "answer.failed"]) {
  for (const tail of ["network error", "malformed event", "stop"]) {
    test(`learning preserves ${terminal} after ${tail}`, { timeout: 1500 }, async (t) => {
      const page = renderLearningPage(t);
      let stream;
      let cancellationRequests = 0;
      t.mock.method(global, "fetch", async (url) => {
        if (url.endsWith("/messages"))
          return new Response(
            new ReadableStream({
              start(controller) {
                stream = controller;
              },
            }),
          );
        if (url.endsWith("/cancel")) {
          cancellationRequests++;
          return envelope({});
        }
        return envelope({ conversation_id: "local-conversation" });
      });
      page
        .find((node) => node.type === "textarea")
        .props.onChange({ target: { value: "已完成的回答应该保留" } });
      page.find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
      await nextTurn();
      assert.ok(stream);
      stream.enqueue(eventBytes({ type: "answer.started", answer_id: "local-answer" }));
      stream.enqueue(eventBytes({ type: "answer.delta", delta: "已经取得的正文" }));
      stream.enqueue(
        eventBytes({ type: terminal, status: "complete", message: "服务端已确认失败" }),
      );
      await nextTurn();
      const status = terminal === "answer.completed" ? "回答完成" : "生成失败 · 已保留内容";
      assert.ok(
        page.text().includes(status),
        "business terminal must be visible before the transport ends",
      );
      if (tail === "network error") stream.error(new Error("tail transport failure"));
      else if (tail === "malformed event")
        stream.enqueue(new TextEncoder().encode("data: malformed\n\n"));
      else {
        const stop = page.find(
          (node) => node.type === "button" && page.nodeText(node).trim() === "停止",
        );
        assert.ok(stop, "tail connection remains open until EOF or local cleanup");
        await stop.props.onClick();
      }
      await nextTurn();
      assert.ok(
        page.text().includes(status),
        "transport cleanup must not rewrite the received terminal",
      );
      assert.ok(page.text().includes("已经取得的正文"));
      if (terminal === "answer.failed") assert.ok(page.text().includes("服务端已确认失败"));
      assert.equal(cancellationRequests, 0, "a terminal answer must not be cancelled remotely");
      assert.equal(page.text().includes("tail transport failure"), false);
    });
  }
}

for (const tail of ["network error", "malformed event"]) {
  test(
    `learning still fails on ${tail} before a business terminal`,
    { timeout: 1500 },
    async (t) => {
      const page = renderLearningPage(t);
      let stream;
      t.mock.method(global, "fetch", async (url) =>
        url.endsWith("/messages")
          ? new Response(
              new ReadableStream({
                start(controller) {
                  stream = controller;
                },
              }),
            )
          : envelope({ conversation_id: "local-conversation" }),
      );
      page
        .find((node) => node.type === "textarea")
        .props.onChange({ target: { value: "未完成回答" } });
      page.find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
      await nextTurn();
      stream.enqueue(eventBytes({ type: "answer.delta", delta: "部分正文" }));
      await nextTurn();
      if (tail === "network error") stream.error(new Error("early transport failure"));
      else stream.enqueue(new TextEncoder().encode("data: malformed\n\n"));
      await nextTurn();
      assert.ok(page.text().includes("生成失败 · 已保留内容"));
      assert.ok(page.text().includes("部分正文"));
    },
  );
}
