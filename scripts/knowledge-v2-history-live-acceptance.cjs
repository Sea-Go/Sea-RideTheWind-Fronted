/** Same-run isolated PG + real User Center + RTW HTTP + two Next BFF versions. */
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const web = path.resolve(__dirname, "..");
const provider = path.resolve(process.argv[2] || "");
const browserMode = process.env.SEA_WEB_REAL_BROWSER === "1";
const expectedProvider = "44f433fcbd2d4a694f424fbcbbefb1a7a1dcd10b";
if (!process.argv[2])
  throw new Error(
    "usage: node scripts/knowledge-v2-history-live-acceptance.cjs <RTW integration checkout>",
  );
const head = (root) =>
  cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(
  head(provider),
  expectedProvider,
  "RTW integration HEAD changed; review it before this acceptance",
);
const source = require("../src/features/knowledge/generated/source-v2-history.json");
const apiHash = crypto
  .createHash("sha256")
  .update(fs.readFileSync(path.join(provider, "api/knowledge.api")))
  .digest("hex");
assert.equal(
  apiHash,
  source.api_sha256,
  "RTW integration DSL differs from the generated v2 contract",
);
const componentsHash = crypto
  .createHash("sha256")
  .update(
    fs.readFileSync(
      path.join(provider, "service/knowledge/generated/typescript/knowledgeComponents.ts"),
    ),
  )
  .digest("hex");
assert.equal(
  componentsHash,
  source.components_sha256,
  "RTW integration goctl DTOs differ from the generated v2 contract",
);
cp.execFileSync(
  "git",
  [
    "diff",
    "--exit-code",
    "--",
    "src/features/knowledge/generated/knowledgeComponents.ts",
    "src/features/knowledge/generated/routes.json",
    "src/features/knowledge/generated/source.json",
  ],
  { cwd: web },
);

const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "sea-web-v2-history-live-"));
fs.chmodSync(evidence, 0o700);
if (browserMode) process.stdout.write(`Browser handoff directory: ${evidence}\n`);
const files = Object.fromEntries(
  [
    "availableReady", "availableRelease", "withdrawnReady", "withdrawnRelease",
    "browserAvailableReady", "browserAvailableObserved",
    "browserWithdrawnReady", "browserWithdrawnObserved",
  ].map((name) => [
    name,
    path.join(evidence, `${name}.json`),
  ]),
);
const processes = [];
const report = {
  schema_version: browserMode
    ? "sea.web.v2-history-real-browser-acceptance.v1"
    : "sea.web.v2-history-live-acceptance.v1",
  web_base_head: head(web),
  rtw_integration_head: head(provider),
  v2_contract_source_head: source.provider_commit,
  v2_api_sha256: source.api_sha256,
  ...(browserMode ? {
    script_sha256: crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex"),
    script_dirty_at_start: cp.spawnSync("git", ["diff", "--quiet", "--", path.relative(web, __filename)],
      { cwd: web }).status !== 0,
  } : {}),
  environment: browserMode
    ? "local isolated PostgreSQL, real User Center RPC/API, RTW HTTP, Next production BFF, local Chrome UI"
    : "local isolated PostgreSQL, real User Center RPC/API, RTW HTTP, Next production BFF",
  checks: [],
  statuses: {},
};
const start = (name, command, args, cwd, env = {}) => {
  const log = fs.openSync(path.join(evidence, `${name}.log`), "w", 0o600);
  const inherited = { ...process.env };
  delete inherited.SEA_KNOWLEDGE_HISTORY_READ_VERSION;
  const child = cp.spawn(command, args, {
    cwd,
    env: { ...inherited, ...env },
    detached: true,
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  processes.push(child);
  return child;
};
const stop = (child) => {
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
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
const fixtureLoginServer = (ready) =>
  new Promise((resolve, reject) => {
    const stats = { matching_login_http_200: 0 };
    const server = http.createServer((request, response) => {
      const respond = (status, payload) => {
        response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify(payload));
      };
      if (request.method !== "POST" || request.url !== "/usercenter/v1/user/login") {
        respond(404, { code: 404, msg: "test fixture login path unavailable", data: null });
        return;
      }
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
        if (body.length > 2048) request.destroy();
      });
      request.on("end", () => {
        let credentials;
        try {
          credentials = JSON.parse(body);
        } catch {
          respond(400, { code: 400, msg: "invalid test fixture credentials", data: null });
          return;
        }
        if (credentials?.username !== "knowledge-history-owner" ||
            credentials?.password !== "test-only-password-123") {
          respond(401, { code: 401, msg: "test fixture login rejected", data: null });
          return;
        }
        // RTW's isolated real User Center signed this short-lived test JWT.
        // The local bridge only gives it to the matching disposable browser login.
        stats.matching_login_http_200++;
        respond(200, { code: 200, msg: "ok", data: { token: ready.product_token } });
      });
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, stats, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
const waitFile = async (target, child, millis) => {
  const deadline = Date.now() + millis;
  while (Date.now() < deadline) {
    if (fs.existsSync(target)) return JSON.parse(fs.readFileSync(target, "utf8"));
    if (child.exitCode !== null)
      throw new Error(`RTW rendezvous exited ${child.exitCode}; see private evidence log`);
    await delay(200);
  }
  throw new Error(`timed out waiting for ${path.basename(target)}`);
};
const waitHTTP = async (base, child) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next server exited ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      if (response.status === 200) return;
    } catch {}
    await delay(200);
  }
  throw new Error("Next production BFF did not become healthy");
};
const read = async (base, route, token, expected, cookie = "") => {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${base}${route}`, { headers, signal: AbortSignal.timeout(15_000) });
  const raw = await response.text();
  assert.equal(
    response.status,
    expected,
    `${route} returned ${response.status}, expected ${expected}`,
  );
  return { raw, data: JSON.parse(raw).data };
};
const release = (target) => fs.writeFileSync(target, "", { flag: "wx", mode: 0o600 });
const readBrowserAX = (stage, page, url) => {
  const file = path.join(evidence, `browser-${stage}-${page}.ax.txt`);
  const stat = fs.statSync(file);
  assert.equal(stat.isFile(), true);
  assert.equal(stat.mode & 0o077, 0, "browser AX observation must remain private");
  assert.ok(stat.size > 0 && stat.size < 256 * 1024, "invalid browser AX observation size");
  const ax = fs.readFileSync(file, "utf8");
  const actualURL = new URL(url);
  assert.ok(ax.includes(`${actualURL.host}${actualURL.pathname}`), `${page} AX URL did not match the fixed history path`);
  return {
    ax,
    sha256: crypto.createHash("sha256").update(ax).digest("hex"),
  };
};
const browserHandoff = async (stage, base, sessionId, answerId, expected, child) => {
  const readyFile = files[stage === "available" ? "browserAvailableReady" : "browserWithdrawnReady"];
  const observedFile = files[stage === "available" ? "browserAvailableObserved" : "browserWithdrawnObserved"];
  const historyURL = `${base}/knowledge/answer-sessions/${encodeURIComponent(sessionId)}`;
  const detailURL = `${historyURL}/${encodeURIComponent(answerId)}`;
  const historyPath = new URL(historyURL).pathname;
  const handoff = {
    schema_version: "sea.web.v2-history-browser-handoff.v1",
    stage,
    login_url: `${base}/login?next=${encodeURIComponent(historyPath)}`,
    login_username: "knowledge-history-owner",
    history_url: historyURL,
    detail_url: detailURL,
    observed_file: observedFile,
  };
  fs.writeFileSync(readyFile, `${JSON.stringify(handoff, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  const observation = await waitFile(observedFile, child, 3 * 60_000);
  assert.equal(observation.schema_version, "sea.web.v2-history-browser-observation.v1");
  assert.equal(observation.stage, stage);
  const required = stage === "available"
    ? ["own_history_visible", "fixed_answer_visible", "citation_available", "quote_visible", "revision_link_visible"]
    : ["fixed_answer_visible", "citation_unavailable", "quote_hidden", "revision_link_hidden"];
  assert.deepEqual(Object.keys(observation.observed).sort(), required.sort());
  for (const check of required) assert.equal(observation.observed[check], true, check);
  const detail = readBrowserAX(stage, "detail", detailURL);
  assert.ok(detail.ax.includes("已接纳答案"), "fixed answer is absent from browser AX");
  if (stage === "available") {
    const list = readBrowserAX(stage, "list", historyURL);
    for (const phrase of ["本会话的已接纳答案", "第 1 条已接纳记录", "第 2 条已接纳记录"])
      assert.ok(list.ax.includes(phrase), `own history AX is missing ${phrase}`);
    for (const phrase of ["当前可用", "接纳时摘录", "打开固定修订"])
      assert.ok(detail.ax.includes(phrase), `available detail AX is missing ${phrase}`);
    assert.ok(detail.ax.includes(`接纳时摘录：${expected.quote}`),
      "browser detail displayed the wrong cited quote");
    assert.ok(detail.ax.includes(expected.href), "browser detail linked to the wrong fixed revision");
    report.browser ??= { mode: "CUA-observed local browser", login: "disposable local JWT handoff", stages: {} };
    report.browser.stages.available = { operator_observed: observation.observed,
      list_ax_sha256: list.sha256, detail_ax_sha256: detail.sha256 };
  } else {
    assert.ok(detail.ax.includes("已撤回或不可用"), "withdrawn citation is absent from browser AX");
    for (const phrase of ["接纳时摘录", "打开固定修订"])
      assert.ok(!detail.ax.includes(phrase), `withdrawn detail AX still exposes ${phrase}`);
    assert.ok(!detail.ax.includes(`接纳时摘录：${expected.quote}`) && !detail.ax.includes(expected.href),
      "withdrawn browser detail retained the cited quote or fixed revision link");
    report.browser.stages.withdrawn = { operator_observed: observation.observed,
      detail_ax_sha256: detail.sha256 };
  }
};
const inspectSubject = (subject) => {
  assert.deepEqual(Object.keys(subject).sort(), ["issuer", "subject_id"]);
  assert.equal(subject.issuer, "rtw.identity");
  assert.match(subject.subject_id, /^[1-9][0-9]*$/);
};

async function main() {
  let providerProcess;
  let browserLoginServer;
  try {
    providerProcess = start(
      "rtw-shared-history",
      "bash",
      ["service/knowledge/scripts/history_shared_acceptance.sh"],
      provider,
      {
        KNOWLEDGE_SHARED_HISTORY_READY: files.availableReady,
        KNOWLEDGE_SHARED_HISTORY_RELEASE: files.availableRelease,
        KNOWLEDGE_SHARED_HISTORY_WITHDRAWN_READY: files.withdrawnReady,
        KNOWLEDGE_SHARED_HISTORY_WITHDRAWN_RELEASE: files.withdrawnRelease,
        ...(browserMode ? { KNOWLEDGE_SHARED_HISTORY_STAGE_TIMEOUT: "10m" } : {}),
      },
    );
    const ready = await waitFile(files.availableReady, providerProcess, 15 * 60_000);
    assert.equal(ready.stage, "available");
    const upstream = new URL(ready.base_url);
    assert.ok(["127.0.0.1", "localhost"].includes(upstream.hostname));
    const v1Port = await freePort();
    const v2Port = await freePort();
    const v1Base = `http://127.0.0.1:${v1Port}`;
    const v2Base = `http://127.0.0.1:${v2Port}`;
    const standalone = path.join(web, ".next/standalone/server.js");
    const common = {
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      SEA_ENABLE_DEMO: "0",
      SEA_PRODUCT_API_SERVER_URL: ready.base_url,
    };
    if (browserMode) browserLoginServer = await fixtureLoginServer(ready);
    const v1 = start("next-v1", process.execPath, [standalone], web, {
      ...common,
      PORT: String(v1Port),
    });
    const v2 = start("next-v2", process.execPath, [standalone], web, {
      ...common,
      PORT: String(v2Port),
      SEA_KNOWLEDGE_HISTORY_READ_VERSION: "v2",
      ...(browserLoginServer ? { USER_CENTER_API_SERVER_URL: browserLoginServer.base } : {}),
    });
    await Promise.all([waitHTTP(v1Base, v1), waitHTTP(v2Base, v2)]);
    const route = `/api/sea/knowledge/answer-sessions/${encodeURIComponent(ready.session_id)}/accepted-answers`;
    const ownV1 = await read(v1Base, `${route}?limit=20`, ready.product_token, 200);
    const ownV2 = await read(v2Base, `${route}?limit=20`, ready.product_token, 200);
    assert.equal(ownV1.data.items.length, 2);
    assert.equal(ownV2.data.items.length, 2);
    for (const [index, row] of ownV2.data.items.entries()) {
      inspectSubject(row.subject);
      assert.equal(row.turn_json, ownV1.data.items[index].turn_json);
      const turn = JSON.parse(row.turn_json);
      assert.deepEqual((turn.Request ?? turn.request).Subject, ownV1.data.items[index].subject);
    }
    const otherV2 = await read(v2Base, `${route}?limit=20`, ready.other_token, 200);
    assert.equal(otherV2.data.items.length, 1);
    inspectSubject(otherV2.data.items[0].subject);
    assert.notEqual(
      otherV2.data.items[0].subject.subject_id,
      ownV2.data.items[0].subject.subject_id,
    );
    const answerRoute = `${route}/${encodeURIComponent(ready.answer_ids[0])}`;
    const v1DetailBefore = await read(v1Base, answerRoute, ready.product_token, 200);
    const v2DetailBefore = await read(v2Base, answerRoute, ready.product_token, 200);
    inspectSubject(v2DetailBefore.data.subject);
    assert.equal(v2DetailBefore.data.turn_json, v1DetailBefore.data.turn_json);
    const originalTurn = JSON.parse(v2DetailBefore.data.turn_json);
    const snapshot = originalTurn.Request?.Search?.Snapshot;
    const evidence = originalTurn.result?.search?.evidence_pack?.evidence?.[0];
    const citationKey = evidence?.key;
    assert.equal(evidence?.quote, ready.expected_quote);
    assert.equal(citationKey?.revision_id, ready.expected_citation_states[0].revision_id);
    assert.ok(snapshot?.module_id && snapshot?.release_id && ["source", "wiki"].includes(citationKey?.source_kind));
    const fixedSourceHref = `/knowledge/${encodeURIComponent(snapshot.module_id)}/${citationKey.source_kind === "source" ? "sources" : "read"}?${new URLSearchParams({
      release: snapshot.release_id,
      revision: citationKey.revision_id,
      ...(evidence.locator?.locator ? { locator: evidence.locator.locator } : {}),
    })}`;
    const browserExpected = { quote: ready.expected_quote, href: fixedSourceHref };
    assert.equal((await read(v2Base, answerRoute, ready.other_token, 404)).data, null);
    await read(
      v2Base,
      `${route}/${encodeURIComponent(otherV2.data.items[0].answer_id)}`,
      ready.product_token,
      404,
    );
    await read(v2Base, `${route}/missing-answer`, ready.product_token, 404);
    await read(v2Base, `${route}?limit=20`, "", 401, "admin_center_token=admin-only");
    assert.equal(
      (await read(v2Base, `${answerRoute}/citations`, ready.product_token, 200)).data.citations[0]
        .state,
      "available",
    );
    report.checks.push(
      "default v1 bytes, v2 subject projection and immutable v1 turn, distinct real UIDs, fixed-ID 404, no User JWT 401, available citation",
    );
    report.statuses.available = {
      v1_list: 200,
      v2_list: 200,
      v2_detail: 200,
      cross_uid: 404,
      no_user_jwt: 401,
      citation: "available",
    };
    if (browserMode) {
      await browserHandoff("available", v2Base, ready.session_id, ready.answer_ids[0], browserExpected, providerProcess);
      assert.ok(browserLoginServer.stats.matching_login_http_200 >= 1,
        "browser reused another local session instead of logging in through the fixture bridge");
      report.browser.fixture_login_http_200 = browserLoginServer.stats.matching_login_http_200;
    }
    release(files.availableRelease);

    const withdrawn = await waitFile(files.withdrawnReady, providerProcess, 8 * 60_000);
    assert.equal(withdrawn.stage, "withdrawn");
    const v1DetailAfter = await read(v1Base, answerRoute, ready.product_token, 200);
    const v2DetailAfter = await read(v2Base, answerRoute, ready.product_token, 200);
    assert.equal(v1DetailAfter.raw, v1DetailBefore.raw);
    assert.equal(v2DetailAfter.data.turn_json, v2DetailBefore.data.turn_json);
    const citation = await read(v2Base, `${answerRoute}/citations`, ready.product_token, 200);
    assert.equal(citation.data.citations[0].state, "unavailable");
    assert.equal(
      citation.data.citations[0].quote_hash,
      ready.expected_citation_states[0].quote_hash,
    );
    report.checks.push(
      "withdrawn citation became unavailable without changing old v1 detail bytes or v2 turn bytes",
    );
    report.statuses.withdrawn = { v1_detail: 200, v2_detail: 200, citation: "unavailable" };
    if (browserMode) await browserHandoff("withdrawn", v2Base, ready.session_id, ready.answer_ids[0], browserExpected, providerProcess);
    release(files.withdrawnRelease);
    const exited =
      providerProcess.exitCode !== null
        ? providerProcess.exitCode
        : await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5 * 60_000);
            providerProcess.once("exit", (code) => {
              clearTimeout(timeout);
              resolve(code);
            });
          });
    assert.equal(exited, 0, "RTW real workflow did not finish cleanly");
    report.result = "PASS";
  } catch (error) {
    report.result = "FAIL";
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    for (const target of [files.availableRelease, files.withdrawnRelease]) {
      if (!fs.existsSync(target))
        try {
          release(target);
        } catch {}
    }
    for (const child of processes.reverse()) stop(child);
    if (browserLoginServer) browserLoginServer.server.close();
    for (const target of Object.values(files))
      try {
        fs.rmSync(target);
      } catch {}
    fs.writeFileSync(path.join(evidence, "report.json"), `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
    process.stdout.write(`Evidence directory: ${evidence}\n`);
  }
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
