/**
 * Same-run real User Center -> production Next BFF -> RTW -> formal BTW cmd/api
 * -> RTW durable answer/citation/history acceptance.
 *
 * Usage: node scripts/knowledge-live-search-acceptance.cjs <RTW> <BTW> <DataCenter>
 */
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const web = path.resolve(__dirname, "..");
const rtw = path.resolve(process.argv[2] || "");
const btw = path.resolve(process.argv[3] || "");
const dc = path.resolve(process.argv[4] || "");
if (!process.argv[2] || !process.argv[3] || !process.argv[4]) {
  throw new Error("RTW, BTW and DataCenter checkout arguments are required");
}

const baselines = {
  web: "4aa9bb484bcc92afb711b556fb57983721ed7df9",
  rtw: "517bd08d6e9e1e5c23a9252fcf03895c058bc164",
  btw: "62a74683874f49f958079e4d1d1e51851ea118cb",
  dc: "f59a676a3439f66122e0ec579cd22f030719e058",
};
const exactHeads = {
  btw: process.env.SEA_WEB_EXPECTED_BTW_SHA?.trim() || baselines.btw,
  dc: process.env.SEA_WEB_EXPECTED_DC_SHA?.trim() || baselines.dc,
};
for (const [name, revision] of Object.entries(exactHeads)) {
  assert.match(revision, /^[0-9a-f]{40}$/, `${name} expected head must be a full commit SHA`);
}
const git = (root, ...args) => cp.execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const head = (root) => git(root, "rev-parse", "HEAD");
const requireAncestor = (root, baseline) => {
  cp.execFileSync("git", ["merge-base", "--is-ancestor", baseline, "HEAD"], { cwd: root });
};
requireAncestor(web, baselines.web);
requireAncestor(rtw, baselines.rtw);
assert.equal(
  head(btw),
  exactHeads.btw,
  "BTW checkout must remain at the reviewed integration head",
);
assert.equal(
  head(dc),
  exactHeads.dc,
  "DataCenter checkout must remain at the reviewed integration head",
);

const requestedEvidence = process.env.SEA_WEB_LIVE_EVIDENCE_DIR?.trim();
const browserMode = process.env.SEA_WEB_REAL_BROWSER === "1";
if (browserMode)
  assert.ok(requestedEvidence, "real-browser mode requires a known evidence directory");
const evidence = requestedEvidence
  ? path.resolve(requestedEvidence)
  : fs.mkdtempSync(path.join(os.tmpdir(), "sea-web-live-search-"));
if (requestedEvidence) fs.mkdirSync(evidence, { mode: 0o700 });
fs.chmodSync(evidence, 0o700);

const files = Object.fromEntries(
  [
    "webSearchReady",
    "webSearchResult",
    "historyAvailableReady",
    "historyAvailableRelease",
    "historyWithdrawnReady",
    "historyWithdrawnRelease",
    "browserSearchReady",
    "browserSearchResult",
    "browserWithdrawnReady",
    "browserWithdrawnResult",
  ].map((name) => [name, path.join(evidence, `${name}.json`)]),
);
const report = {
  schema_version: "sea.web.live-product-search-acceptance.v1",
  started_at: new Date().toISOString(),
  repositories: {
    web: { baseline: baselines.web, head: head(web) },
    rtw: { baseline: baselines.rtw, head: head(rtw) },
    btw: { baseline: baselines.btw, head: head(btw) },
    datacenter: { baseline: baselines.dc, head: head(dc) },
  },
  execution: {
    web: "Next production standalone server and real BFF HTTP",
    identity: "real RTW User Center register/login processes",
    retrieval:
      "official hash-pinned BGE-M3 through DataCenter typed representations and three local-exact lanes",
    summary_model: "fixed local OpenAI-compatible model fixture after accepted evidence",
    search_runtime: "formal BreakTheWaves cmd/api with tRPC-Agent-Go Graph/Runner",
    persistence: "RTW isolated PostgreSQL",
    browser: browserMode ? "real local browser hydration and interaction" : "not run",
  },
  checks: [],
  http: [],
  limitations: [
    "The summary model is a deterministic local fixture; this run does not measure LLM answer quality.",
    "The corpus is a two-chunk isolated fixture; this run does not measure retrieval relevance or scale.",
    ...(browserMode
      ? [
          "One local browser session is observed; this is not a cross-browser or accessibility audit.",
        ]
      : [
          "Browser sessionStorage and visual rendering require a separate real-browser observation.",
        ]),
    "No production deployment or shared database is used.",
  ],
};

const children = new Map();
const launch = (name, command, args, cwd, env = {}) => {
  const logPath = path.join(evidence, `${name}.log`);
  const log = fs.openSync(logPath, "a", 0o600);
  const child = cp.spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", log, log],
  });
  const state = { child, log, logPath, exit: null, signal: null };
  state.done = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      state.exit = code;
      state.signal = signal;
      fs.closeSync(log);
      resolve({ code, signal });
    });
  });
  children.set(name, state);
  return state;
};
const processLog = (state) => {
  try {
    return fs.readFileSync(state.logPath, "utf8");
  } catch {
    return "";
  }
};
const withTimeout = async (promise, timeoutMillis) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMillis);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
const stop = async (name) => {
  const state = children.get(name);
  if (!state || state.exit !== null || state.signal !== null) return;
  try {
    process.kill(-state.child.pid, "SIGTERM");
  } catch {}
  const result = await withTimeout(state.done, 15000);
  if (result === null) {
    try {
      process.kill(-state.child.pid, "SIGKILL");
    } catch {}
    await state.done;
  }
};
const privateTouch = (target) => {
  const descriptor = fs.openSync(target, "wx", 0o600);
  fs.closeSync(descriptor);
};
const releaseIfMissing = (target) => {
  if (!fs.existsSync(target)) {
    try {
      privateTouch(target);
    } catch {}
  }
};
const writeJSONExclusive = (target, value) => {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
};
const readJSON = (target) => JSON.parse(fs.readFileSync(target, "utf8"));
const readPrivateJSON = (target) => {
  const info = fs.statSync(target);
  assert.ok(info.isFile());
  assert.equal(info.mode & 0o077, 0);
  assert.ok(info.size > 0 && info.size <= 64 << 10);
  return readJSON(target);
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const loopback = (value) => {
  const parsed = new URL(value);
  assert.equal(parsed.protocol, "http:");
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname));
  return parsed.toString().replace(/\/$/, "");
};
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });

const waitFor = async (description, predicate, state, timeoutMillis) => {
  const end = Date.now() + timeoutMillis;
  while (Date.now() < end) {
    if (state && (state.exit !== null || state.signal !== null)) {
      throw new Error(
        `${description}: process exited code=${state.exit} signal=${state.signal}\n${processLog(state)}`,
      );
    }
    const value = await predicate();
    if (value) return value;
    await delay(200);
  }
  throw new Error(`${description}: timed out`);
};

const recordHTTP = (name, url, method, status, raw) => {
  report.http.push({
    name,
    method,
    path: new URL(url).pathname,
    status,
    response_sha256: sha256(raw),
    response_bytes: Buffer.byteLength(raw),
  });
};
const httpJSON = async (
  name,
  url,
  { method = "GET", token = "", cookie = "", body } = {},
  expected,
) => {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: `user_center_token=${cookie}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const raw = await response.text();
  recordHTTP(name, url, method, response.status, raw);
  assert.equal(response.status, expected, `${name}: ${raw}`);
  const payload = JSON.parse(raw);
  assert.equal(payload.code, expected, `${name} envelope code`);
  return { payload, raw, response };
};
const httpPage = async (name, url, cookie) => {
  const response = await fetch(url, {
    headers: { Accept: "text/html", Cookie: `user_center_token=${cookie}` },
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  recordHTTP(name, url, "GET", response.status, raw);
  assert.equal(response.status, 200, `${name} page status`);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  return raw;
};
const equalJSON = (left, right) => assert.deepEqual(left, right);

let dcState;
let rtwState;
let nextState;
let dcRelease;
let resultWritten = false;

(async () => {
  try {
    const standalone = path.join(web, ".next", "standalone", "server.js");
    assert.ok(fs.statSync(standalone).isFile(), "run pnpm build before the live acceptance");

    const servingRoot = path.join(btw, "training", "serving", "bge_m3");
    const modelDirectory =
      process.env.BGE_MODEL_DIRECTORY ||
      "/Users/edy/.cache/sea-models/bge-m3/5617a9f61b028005a4858fdac845db406aefb181";
    dcState = launch("datacenter-bge", "bash", ["scripts/test-bge-representations.sh"], dc, {
      BGE_HOLD_FOR_CONSUMER: "1",
      BGE_SERVING_ROOT: servingRoot,
      BGE_MODEL_DIRECTORY: modelDirectory,
      BGE_PG_BIN: process.env.BGE_PG_BIN || "/opt/homebrew/opt/postgresql@16/bin",
    });
    const runtime = await waitFor(
      "DataCenter BGE runtime",
      async () => {
        const match = processLog(dcState).match(/^Live evidence directory: (.+)$/m);
        if (!match) return null;
        const candidate = path.join(match[1].trim(), "runtime.json");
        return fs.existsSync(candidate) && fs.statSync(candidate).size > 0 ? candidate : null;
      },
      dcState,
      12 * 60 * 1000,
    );
    const runtimeInfo = readJSON(runtime);
    loopback(runtimeInfo.endpoint);
    assert.deepEqual(Object.keys(runtimeInfo.configurations).sort(), [
      "dense",
      "sparse",
      "token_matrix",
    ]);
    dcRelease = runtimeInfo.release_file;
    report.checks.push("DataCenter exposed all three typed BGE-M3 representation configurations");

    rtwState = launch(
      "rtw-btw",
      "bash",
      ["service/knowledge/scripts/history_shared_acceptance.sh"],
      rtw,
      {
        KNOWLEDGE_SHARED_HISTORY_READY: files.historyAvailableReady,
        KNOWLEDGE_SHARED_HISTORY_RELEASE: files.historyAvailableRelease,
        KNOWLEDGE_SHARED_HISTORY_WITHDRAWN_READY: files.historyWithdrawnReady,
        KNOWLEDGE_SHARED_HISTORY_WITHDRAWN_RELEASE: files.historyWithdrawnRelease,
        KNOWLEDGE_WEB_SEARCH_READY: files.webSearchReady,
        KNOWLEDGE_WEB_SEARCH_RESULT: files.webSearchResult,
        KNOWLEDGE_KEEP_EVIDENCE: "1",
        SEA_DC_BGE_RUNTIME: runtime,
        SEA_BTW_PRODUCT_SEARCH_ROOT: btw,
        SEA_BTW_SEARCH_API_SOCKET_ROOT: btw,
      },
    );
    await waitFor(
      "RTW Web search rendezvous",
      async () => (fs.existsSync(files.webSearchReady) ? files.webSearchReady : null),
      rtwState,
      20 * 60 * 1000,
    );
    const ready = readJSON(files.webSearchReady);
    assert.equal(ready.schema_version, "sea.web.product-search-handoff.v1");
    assert.equal(ready.stage, "search");
    const rtwBase = loopback(ready.rtw_base_url);
    const userCenterBase = loopback(ready.user_center_base_url);
    assert.equal(ready.depth, "fast");
    assert.equal(ready.intelligence, "low");

    const webPort = await freePort();
    const webBase = `http://127.0.0.1:${webPort}`;
    nextState = launch("next", process.execPath, [standalone], web, {
      HOSTNAME: "127.0.0.1",
      PORT: String(webPort),
      NODE_ENV: "production",
      SEA_ENABLE_DEMO: "0",
      SEA_PRODUCT_API_SERVER_URL: rtwBase,
      USER_CENTER_API_SERVER_URL: userCenterBase,
    });
    await waitFor(
      "Next production server",
      async () => {
        try {
          const response = await fetch(`${webBase}/login`, { signal: AbortSignal.timeout(1000) });
          await response.body?.cancel();
          return response.status === 200;
        } catch {
          return false;
        }
      },
      nextState,
      60 * 1000,
    );

    const login = async (name, username) => {
      const { payload } = await httpJSON(
        name,
        `${webBase}/api/usercenter/v1/user/login`,
        { method: "POST", body: { username, password: ready.login_password } },
        200,
      );
      assert.equal(typeof payload.data?.token, "string");
      assert.ok(payload.data.token.length > 20);
      return payload.data.token;
    };
    const ownerToken = await login("owner-login-through-next-bff", ready.login_username);
    const otherToken = await login("other-login-through-next-bff", ready.other_username);
    const ownerProfile = await httpJSON(
      "owner-profile-through-next-bff",
      `${webBase}/api/usercenter/v1/user/get`,
      { token: ownerToken },
      200,
    );
    const otherProfile = await httpJSON(
      "other-profile-through-next-bff",
      `${webBase}/api/usercenter/v1/user/get`,
      { token: otherToken },
      200,
    );
    assert.notEqual(ownerProfile.payload.data.user.uid, otherProfile.payload.data.user.uid);
    report.identity = {
      owner_uid: ownerProfile.payload.data.user.uid,
      other_uid: otherProfile.payload.data.user.uid,
      token_source: "Next User Center BFF login",
    };
    report.checks.push("Next BFF logged into two distinct real User Center accounts");

    const sessionPath = `/knowledge/answer-sessions/${encodeURIComponent(ready.session_id)}`;
    const entryPage = await httpPage(
      "answer-session-page-shell",
      `${webBase}${sessionPath}?module_id=${encodeURIComponent(ready.module_id)}`,
      ownerToken,
    );
    // Authentication and the search form are hydrated from the browser's local
    // session. A raw HTTP fetch can prove the production page route and assets,
    // while the following BFF requests prove the authenticated product chain.
    assert.match(entryPage, /问答历史/);
    assert.match(entryPage, /请先登录/);
    report.checks.push("Next production server served the answer-session page shell");

    const requestBody = {
      module_id: ready.module_id,
      query: ready.query,
      depth: ready.depth,
      intelligence: ready.intelligence,
      idempotency_key: ready.idempotency_key,
    };
    const productPath = `${webBase}/api/sea/knowledge/answer-sessions/${encodeURIComponent(ready.session_id)}/searches`;
    let product;
    if (browserMode) {
      const sessionURL = `${webBase}${sessionPath}?module_id=${encodeURIComponent(ready.module_id)}`;
      writeJSONExclusive(files.browserSearchReady, {
        schema_version: "sea.web.real-browser-handoff.v1",
        stage: "search",
        login_url: `${webBase}/login?next=${encodeURIComponent(`${sessionPath}?module_id=${encodeURIComponent(ready.module_id)}`)}`,
        session_url: sessionURL,
        login_username: ready.login_username,
        login_password: ready.login_password,
        input: {
          module_id: requestBody.module_id,
          query: requestBody.query,
          depth: requestBody.depth,
          intelligence: requestBody.intelligence,
        },
        result_file: files.browserSearchResult,
      });
      await waitFor(
        "real browser search observation",
        async () => (fs.existsSync(files.browserSearchResult) ? files.browserSearchResult : null),
        rtwState,
        12 * 60 * 1000,
      );
      const observation = readPrivateJSON(files.browserSearchResult);
      assert.deepEqual(Object.keys(observation).sort(), [
        "current_url",
        "observed",
        "schema_version",
        "stage",
      ]);
      assert.equal(observation.schema_version, "sea.web.real-browser-observation.v1");
      assert.equal(observation.stage, "search-completed");
      const current = new URL(observation.current_url);
      assert.equal(current.origin, webBase);
      const answerPrefix = `${sessionPath}/`;
      assert.ok(current.pathname.startsWith(answerPrefix));
      const answerID = decodeURIComponent(current.pathname.slice(answerPrefix.length));
      assert.ok(answerID && !answerID.includes("/"));
      assert.deepEqual(observation.observed, {
        hydrated_search_controls: true,
        search_submitted: true,
        accepted_answer_heading: true,
        answer_visible: true,
        citation_state: "available",
        quote_visible: true,
        fixed_revision_link_visible: true,
      });
      fs.rmSync(files.browserSearchReady);
      const accepted = await httpJSON(
        "browser-created-answer-through-next-bff",
        `${webBase}/api/sea/knowledge/answer-sessions/${encodeURIComponent(ready.session_id)}/accepted-answers/${encodeURIComponent(answerID)}`,
        { token: ownerToken, cookie: ownerToken },
        200,
      );
      assert.equal(accepted.payload.data.answer_id, answerID);
      assert.ok(accepted.payload.data.search_id);
      const browserOperation = await httpJSON(
        "browser-created-search-recovered-through-next-bff",
        `${productPath}/${encodeURIComponent(accepted.payload.data.search_id)}`,
        { token: ownerToken, cookie: ownerToken },
        200,
      );
      product = browserOperation.payload.data;
      assert.equal(product.answer_id, answerID);
      report.browser = {
        mode: "real-local-browser",
        search: observation.observed,
        current_path_sha256: sha256(current.pathname),
      };
      report.checks.push(
        "A real browser hydrated the search controls and submitted one product search request",
      );
    } else {
      const created = await httpJSON(
        "product-search-through-next-bff",
        productPath,
        { method: "POST", token: ownerToken, cookie: ownerToken, body: requestBody },
        200,
      );
      product = created.payload.data;
    }
    assert.equal(product.status, "succeeded");
    assert.ok(product.search_id && product.answer_id && product.answer?.trim());
    assert.equal(product.citations?.length, 1);
    assert.equal(product.citations[0].quote, ready.query);
    assert.ok(product.citation_receipt_ref);

    const operationPath = `${productPath}/${encodeURIComponent(product.search_id)}`;
    const recovered = await httpJSON(
      "fixed-search-get-through-next-bff",
      operationPath,
      { token: ownerToken, cookie: ownerToken },
      200,
    );
    equalJSON(recovered.payload.data, product);
    if (!browserMode) {
      const replayed = await httpJSON(
        "same-key-replay-through-next-bff",
        productPath,
        { method: "POST", token: ownerToken, cookie: ownerToken, body: requestBody },
        200,
      );
      equalJSON(replayed.payload.data, product);
    }
    await httpJSON(
      "other-user-fixed-search-isolation",
      operationPath,
      { token: otherToken, cookie: otherToken },
      404,
    );
    const otherHistory = await httpJSON(
      "other-user-history-isolation",
      `${webBase}/api/sea/knowledge/answer-sessions/${encodeURIComponent(ready.session_id)}/accepted-answers?limit=20`,
      { token: otherToken, cookie: otherToken },
      200,
    );
    assert.deepEqual(otherHistory.payload.data.items, []);
    report.checks.push(
      browserMode
        ? "Web BFF fixed GET recovered the browser-created RTW operation without cross-user exposure"
        : "Web BFF POST replay and fixed GET recovered one RTW operation without cross-user exposure",
    );

    writeJSONExclusive(files.webSearchResult, {
      schema_version: ready.schema_version,
      bff_base_url: webBase,
      login_http_status: 200,
      page_http_status: 200,
      search_http_status: 200,
      product_search: product,
    });
    resultWritten = true;

    await waitFor(
      "RTW available history stage",
      async () => (fs.existsSync(files.historyAvailableReady) ? files.historyAvailableReady : null),
      rtwState,
      8 * 60 * 1000,
    );
    const availableReady = readJSON(files.historyAvailableReady);
    assert.equal(availableReady.stage, "available");
    const historyPath = `${webBase}/api/sea/knowledge/answer-sessions/${encodeURIComponent(ready.session_id)}/accepted-answers`;
    const history = await httpJSON(
      "owner-durable-history-through-next-bff",
      `${historyPath}?limit=20`,
      { token: ownerToken, cookie: ownerToken },
      200,
    );
    assert.ok(
      history.payload.data.items.some(
        (item) => item.answer_id === product.answer_id && item.search_id === product.search_id,
      ),
    );
    const answerPath = `${historyPath}/${encodeURIComponent(product.answer_id)}`;
    const answer = await httpJSON(
      "owner-durable-answer-through-next-bff",
      answerPath,
      { token: ownerToken, cookie: ownerToken },
      200,
    );
    assert.equal(answer.payload.data.answer_id, product.answer_id);
    const available = await httpJSON(
      "available-citation-through-next-bff",
      `${answerPath}/citations`,
      { token: ownerToken, cookie: ownerToken },
      200,
    );
    assert.equal(available.payload.data.citations.length, 1);
    assert.equal(available.payload.data.citations[0].state, "available");
    const answerPage = await httpPage(
      "answer-detail-page-shell",
      `${webBase}${sessionPath}/${encodeURIComponent(product.answer_id)}`,
      ownerToken,
    );
    assert.match(answerPage, /问答历史|历史答案/);
    report.checks.push("Web BFF read the RTW durable answer and available fixed citation");
    privateTouch(files.historyAvailableRelease);

    await waitFor(
      "RTW withdrawn history stage",
      async () => (fs.existsSync(files.historyWithdrawnReady) ? files.historyWithdrawnReady : null),
      rtwState,
      8 * 60 * 1000,
    );
    const withdrawnReady = readJSON(files.historyWithdrawnReady);
    assert.equal(withdrawnReady.stage, "withdrawn");
    const withdrawn = await httpJSON(
      "withdrawn-citation-through-next-bff",
      `${answerPath}/citations`,
      { token: ownerToken, cookie: ownerToken },
      200,
    );
    assert.equal(withdrawn.payload.data.citations.length, 1);
    assert.equal(withdrawn.payload.data.citations[0].state, "unavailable");
    const historicalAnswer = await httpJSON(
      "historical-answer-remains-through-next-bff",
      answerPath,
      { token: ownerToken, cookie: ownerToken },
      200,
    );
    equalJSON(historicalAnswer.payload.data, answer.payload.data);
    await httpJSON(
      "other-user-answer-isolation-after-withdrawal",
      answerPath,
      { token: otherToken, cookie: otherToken },
      404,
    );
    if (browserMode) {
      writeJSONExclusive(files.browserWithdrawnReady, {
        schema_version: "sea.web.real-browser-handoff.v1",
        stage: "withdrawn",
        refresh_url: `${webBase}${sessionPath}/${encodeURIComponent(product.answer_id)}`,
        answer_id: product.answer_id,
        result_file: files.browserWithdrawnResult,
      });
      await waitFor(
        "real browser withdrawn citation observation",
        async () =>
          fs.existsSync(files.browserWithdrawnResult) ? files.browserWithdrawnResult : null,
        rtwState,
        8 * 60 * 1000,
      );
      const observation = readPrivateJSON(files.browserWithdrawnResult);
      assert.deepEqual(Object.keys(observation).sort(), [
        "current_url",
        "observed",
        "schema_version",
        "stage",
      ]);
      assert.equal(observation.schema_version, "sea.web.real-browser-observation.v1");
      assert.equal(observation.stage, "withdrawn-observed");
      const current = new URL(observation.current_url);
      assert.equal(current.origin, webBase);
      assert.equal(current.pathname, `${sessionPath}/${encodeURIComponent(product.answer_id)}`);
      assert.deepEqual(observation.observed, {
        accepted_answer_heading: true,
        answer_visible: true,
        citation_state: "unavailable",
        quote_visible: false,
        fixed_revision_link_visible: false,
      });
      report.browser.withdrawn = observation.observed;
      report.browser.withdrawn_path_sha256 = sha256(current.pathname);
      report.checks.push(
        "The same browser refreshed the fixed answer after withdrawal and hid the quote and source link",
      );
    }
    report.checks.push(
      "RTW withdrawal changed the same Web citation to unavailable while retaining its historical answer",
    );
    privateTouch(files.historyWithdrawnRelease);

    const rtwExit = await withTimeout(rtwState.done, 8 * 60 * 1000);
    assert.ok(rtwExit, "RTW acceptance did not exit");
    assert.equal(rtwExit.code, 0, processLog(rtwState));
    releaseIfMissing(dcRelease);
    const dcExit = await withTimeout(dcState.done, 5 * 60 * 1000);
    assert.ok(dcExit, "DataCenter acceptance did not exit");
    assert.equal(dcExit.code, 0, processLog(dcState));

    report.product = {
      module_id: ready.module_id,
      session_id: ready.session_id,
      search_id: product.search_id,
      answer_id: product.answer_id,
      answer_sha256: sha256(product.answer),
      citation_receipt_ref: product.citation_receipt_ref,
      evidence_id: product.citations[0].evidence_id,
      quote_sha256: sha256(product.citations[0].quote),
      state_before_withdrawal: "available",
      state_after_withdrawal: "unavailable",
    };
    report.processes = {
      datacenter_bge_exit: dcExit.code,
      rtw_btw_exit: rtwExit.code,
      next_server_observed: true,
    };
    report.completed_at = new Date().toISOString();
    report.status = "passed";
    writeJSONExclusive(path.join(evidence, "report.json"), report);
    console.log(
      JSON.stringify(
        {
          status: report.status,
          evidence_directory: evidence,
          report: path.join(evidence, "report.json"),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    report.status = "failed";
    report.error = error instanceof Error ? error.stack : String(error);
    report.completed_at = new Date().toISOString();
    try {
      if (!fs.existsSync(path.join(evidence, "report.json"))) {
        writeJSONExclusive(path.join(evidence, "report.json"), report);
      }
    } catch {}
    console.error(report.error);
    console.error(`Evidence directory: ${evidence}`);
    process.exitCode = 1;
  } finally {
    try {
      fs.rmSync(files.browserSearchReady);
    } catch {}
    if (!resultWritten) {
      // The RTW process is terminated below; no forged result is written.
    }
    releaseIfMissing(files.historyAvailableRelease);
    releaseIfMissing(files.historyWithdrawnRelease);
    if (dcRelease) releaseIfMissing(dcRelease);
    await stop("next");
    await stop("rtw-btw");
    await stop("datacenter-bge");
  }
})();
