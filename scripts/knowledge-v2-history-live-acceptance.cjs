/** Same-run isolated PG + real User Center + RTW HTTP + two Next BFF versions. */
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const web = path.resolve(__dirname, "..");
const provider = path.resolve(process.argv[2] || "");
const expectedProvider = "730d16198b871ad8f26984f2f33361f5ca13f0c6";
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
const files = Object.fromEntries(
  ["availableReady", "availableRelease", "withdrawnReady", "withdrawnRelease"].map((name) => [
    name,
    path.join(evidence, `${name}.json`),
  ]),
);
const processes = [];
const report = {
  schema_version: "sea.web.v2-history-live-acceptance.v1",
  web_base_head: head(web),
  rtw_integration_head: head(provider),
  v2_contract_source_head: source.provider_commit,
  v2_api_sha256: source.api_sha256,
  environment: "local isolated PostgreSQL, real User Center RPC/API, RTW HTTP, Next production BFF",
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
const inspectSubject = (subject) => {
  assert.deepEqual(Object.keys(subject).sort(), ["issuer", "subject_id"]);
  assert.equal(subject.issuer, "rtw.identity");
  assert.match(subject.subject_id, /^[1-9][0-9]*$/);
};

async function main() {
  let providerProcess;
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
    const v1 = start("next-v1", process.execPath, [standalone], web, {
      ...common,
      PORT: String(v1Port),
    });
    const v2 = start("next-v2", process.execPath, [standalone], web, {
      ...common,
      PORT: String(v2Port),
      SEA_KNOWLEDGE_HISTORY_READ_VERSION: "v2",
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
