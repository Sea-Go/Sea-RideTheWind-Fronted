/** Disposable PostgreSQL + real Go service + production Next BFF.
 * H06 artifacts below are explicitly structural fixtures, never real encoder/index evidence.
 * Usage: node scripts/knowledge-acceptance.cjs <RTW checkout>
 * Optional KNOWLEDGE_KEEP_RUNNING=1 keeps the disposable app open for manual browser QA.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const net = require("node:net");
const http = require("node:http");
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");
const provider = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("RTW checkout argument is required");
const wikiFactSetMode = process.env.SEA_WEB_WIKI_FACT_SET_ACCEPTANCE === "1";
const wikiQualityMode = process.env.SEA_WEB_WIKI_QUALITY_ACCEPTANCE === "1" || wikiFactSetMode;
const web = path.resolve(__dirname, "..");
const pg = process.env.KNOWLEDGE_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sea-web-knowledge-acceptance-"));
const children = [];
let cluster = false,
  bootstrap;
const report = {
  background: "BG-2026-09-13-r2",
  started_at: new Date().toISOString(),
  provider_commit: cp
    .execFileSync("git", ["rev-parse", "HEAD"], { cwd: provider, encoding: "utf8" })
    .trim(),
  web_source_commit: cp
    .execFileSync("git", ["rev-parse", "HEAD"], { cwd: web, encoding: "utf8" })
    .trim(),
  next_build_id: fs.readFileSync(path.join(web, ".next/BUILD_ID"), "utf8").trim(),
  checks: [],
  limitations: [
    "Synthetic admin JWT on an isolated local PostgreSQL instance",
    "Local content-addressed object backend",
    "H06 structural fixture only; no real AI compilation, Dense/Sparse/Multi-vector model or query quality",
    "No production deployment",
    ...(wikiFactSetMode
      ? [
          "FactSet completeness is an isolated administrator declaration, not externally verified page quality or D07",
        ]
      : wikiQualityMode
        ? [
            "Single human Wiki fact only; no complete FactSet, D07 quality threshold, or automatic Release",
          ]
        : []),
  ],
};
const check = (name, fn) => {
  fn();
  report.checks.push(name);
};
const port = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const n = s.address().port;
      s.close(() => resolve(n));
    });
  });
const run = (bin, args, cwd = web) =>
  cp.execFileSync(bin, args, {
    cwd,
    stdio: [
      "ignore",
      fs.openSync(path.join(dir, "setup.log"), "a"),
      fs.openSync(path.join(dir, "setup.log"), "a"),
    ],
  });
function launch(name, bin, args, env, cwd = web) {
  const log = fs.openSync(path.join(dir, `${name}.log`), "a");
  const child = cp.spawn(bin, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", log, log],
  });
  children.push(child);
  child.on("error", (e) => console.error(name, e.message));
  return child;
}
async function wait(url, child) {
  for (let n = 0; n < 120; n++) {
    if (child && (child.exitCode !== null || child.signalCode !== null))
      throw new Error(`Startup process exited before ${url} became ready`);
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Startup timed out: ${url}`);
}
function cleanup() {
  bootstrap?.close();
  for (const child of children.reverse()) child.kill("SIGTERM");
  if (cluster) {
    try {
      run(path.join(pg, "pg_ctl"), ["-D", path.join(dir, "pg"), "-m", "fast", "stop"]);
    } catch {}
    cluster = false;
  }
  fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(report, null, 2));
}
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
(async () => {
  const pgPort = await port(),
    apiPort = await port(),
    webPort = await port(),
    sessionPort = await port();
  run(path.join(pg, "initdb"), [
    "-D",
    path.join(dir, "pg"),
    "-A",
    "trust",
    "--no-locale",
    "-U",
    "sea_web_test",
  ]);
  run(path.join(pg, "pg_ctl"), [
    "-D",
    path.join(dir, "pg"),
    "-l",
    path.join(dir, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${pgPort} -k ${dir}`,
    "start",
  ]);
  cluster = true;
  const objectDir = path.join(dir, "objects");
  fs.mkdirSync(path.join(objectDir, "sha256"), { recursive: true });
  const secret = crypto.randomBytes(32).toString("hex"),
    worker = crypto.randomBytes(24).toString("hex");
  const encoded = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const payload = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ userId: "web-fixture-admin", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  const token = `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("base64url")}`;
  const config = {
    Name: "knowledge-web-acceptance",
    Host: "127.0.0.1",
    Port: apiPort,
    Mode: "test",
    Timeout: 15000,
    MaxBytes: 16777216,
    Log: { Mode: "console", Level: "error" },
    Observability: { Version: report.provider_commit },
    Auth: { AccessSecret: secret, AccessExpire: 3600 },
    UserAuth: { AccessSecret: crypto.randomBytes(32).toString("hex") },
    UserRpc: { Endpoints: ["127.0.0.1:1"] },
    AdministratorIDs: ["web-fixture-admin"],
    WorkerToken: worker,
    Postgres: {
      DSN: `postgres://sea_web_test@127.0.0.1:${pgPort}/postgres?sslmode=disable`,
      MaxConnections: 8,
      Migrate: true,
    },
    Objects: { Backend: "local", LocalDirectory: objectDir },
    ...(wikiQualityMode ? { WikiQualityJudgments: { Enabled: true } } : {}),
    ...(wikiFactSetMode ? { WikiFactSets: { Enabled: true } } : {}),
  };
  const configPath = path.join(dir, "api.json");
  fs.writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  run("go", ["build", "-o", path.join(dir, "knowledge-api"), "./service/knowledge/api"], provider);
  const apiChild = launch("api", path.join(dir, "knowledge-api"), ["-f", configPath], {}, provider);
  const upstream = `http://127.0.0.1:${apiPort}`,
    base = `http://127.0.0.1:${webPort}`;
  await wait(`${upstream}/v1/knowledge/modules`, apiChild);
  launch("next", process.execPath, [path.join(web, ".next/standalone/server.js")], {
    HOSTNAME: "127.0.0.1",
    PORT: String(webPort),
    SEA_PRODUCT_API_SERVER_URL: upstream,
    SEA_ENABLE_DEMO: "0",
  });
  await wait(`${base}/api/sea/knowledge/modules`);
  async function call(
    route,
    method = "GET",
    body,
    expected = 200,
    internal = false,
    anonymous = false,
  ) {
    const response = await fetch(
      `${internal ? upstream + "/internal/v1/knowledge/" : base + "/api/sea/knowledge/"}${route}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(!anonymous ? { Authorization: `Bearer ${internal ? worker : token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    const bodyText = await response.text();
    let json = null;
    if (bodyText) {
      try {
        json = JSON.parse(bodyText);
      } catch {
        throw new Error(`${method} ${route}: upstream returned non-JSON HTTP ${response.status}`);
      }
    }
    assert.equal(response.status, expected, `${method} ${route}: ${bodyText.slice(0, 500)}`);
    if (expected === 200 && (!json || json.code !== 200 || !Object.hasOwn(json, "data")))
      throw new Error(`${method} ${route}: successful response lost its RTW envelope`);
    return json?.data;
  }
  const key = () => crypto.randomUUID();
  const source = (module, title, content) =>
    call(`modules/${module.id}/sources`, "POST", {
      title,
      content,
      media_type: "text/markdown",
      provenance: "isolated acceptance source fixture",
      idempotency_key: key(),
    });
  const profile = ["dense", "sparse", "multivector"].map((lane) => ({
    lane,
    encoder: `fixture-${lane}`,
    tokenizer: "fixture-tokenizer",
    space: `fixture-${lane}-space`,
    dimensions: 4,
    ...(lane === "multivector" ? { mask: "attention", aggregation: "maxsim" } : {}),
  }));
  const release = (module, sources, wiki) =>
    call(`modules/${module.id}/releases`, "POST", {
      source_revision_ids: sources.map((r) => r.revision_id),
      wiki_revision_ids: [wiki.revision_id],
      chunking_profile: "structural-fixture-v1",
      retrieval_profiles: profile,
      idempotency_key: key(),
    });
  const put = (value) => {
    const data = Buffer.from(JSON.stringify(value));
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    const target = path.join(objectDir, "sha256", hash);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), data);
    else fs.writeFileSync(target, data, { flag: "wx" });
    return { key: `sha256/${hash}`, sha256: hash };
  };
  async function ready(release) {
    const b = await call(`releases/${release.release_id}/index-builds`, "POST", {
      idempotency_key: key(),
    });
    const claim = {
      generation: b.generation,
      attempt_id: `fixture-${b.build_id}`,
      lease_epoch: 1,
      cancel_version: b.cancel_version,
      manifest_hash: b.manifest_hash,
      lease_expires_at: new Date(Date.now() + 600000).toISOString(),
    };
    await call(`builds/${b.build_id}/claim`, "POST", claim, 200, true);
    const manifest = put({
      schema_version: 1,
      build_id: b.build_id,
      release_id: release.release_id,
      generation: b.generation,
      input_manifest_hash: b.manifest_hash,
      chunk_count: 1,
      chunk_manifest: put({ fixture: true, revision_ids: release.source_revision_ids }),
      lanes: profile.map((p) => ({
        profile: p,
        artifact: put({ build: b.build_id, lane: p.lane, fixture: true }),
        chunk_count: 1,
        shards: 1,
        probe_passed: true,
        probe: put({
          build: b.build_id,
          lane: p.lane,
          evidence: "structural fixture; no model or index query executed",
        }),
      })),
    });
    return call(
      `builds/${b.build_id}/results`,
      "POST",
      {
        ...claim,
        state: "READY",
        index_manifest_ref: manifest.key,
        index_manifest_hash: manifest.sha256,
      },
      200,
      true,
    );
  }
  const module = await call("modules", "POST", {
    title: "知识工作台集成验收 · 结构 fixture",
    description: "真实网页与 Go/PG，算法工件仅供协议验收。",
    category: "隔离验收",
    idempotency_key: key(),
  });
  check("module creation stays out of the published shelf", () => assert.ok(module.id));
  const publicDraft = await call("modules", "GET", undefined, 200, false, true);
  await call(`modules/${module.id}`, "GET", undefined, 404, false, true);
  assert.equal(
    publicDraft.items.some((m) => m.id === module.id),
    false,
  );
  const drafts = await call("workbench/modules");
  check("administrator workbench contains the unpublished module", () =>
    assert.ok(drafts.items.some((m) => m.id === module.id)),
  );
  const a = await source(module, "书 A 原文", "海拔影响温度。\n\n坡向影响光照。");
  const createWiki = (title, content, refs, base) =>
    call(`modules/${module.id}/wiki-pages/climate/revisions`, "POST", {
      title,
      content,
      source_refs: refs.map((r) => ({ revision_id: r.revision_id, locator: "paragraph:1" })),
      ...(base ? { base_revision_id: base.revision_id } : {}),
      idempotency_key: key(),
    });
  const wiki1 = await createWiki("山地与气候 v1", "## 第一版\n\n海拔影响山地气温。", [a]);
  let qualityUserToken = "";
  if (wikiQualityMode) {
    const quote = "坡向影响光照。";
    const path = `modules/${module.id}/wiki-pages/climate/revisions/${wiki1.revision_id}/quality-judgments`;
    const input = {
      source_revision_id: a.revision_id,
      source_content_sha256: a.content_hash,
      locator: "paragraph:2",
      source_quote: quote,
      source_quote_sha256: crypto.createHash("sha256").update(Buffer.from(quote)).digest("hex"),
      assessment: "missing",
      grade: "0",
      rubric_version: "sea.wiki.fact-coverage.v1",
      reason: "固定原文第二段的光照事实尚未写进这一版 Wiki",
      idempotency_key: key(),
    };
    await call(path, "POST", input, 401, false, true);
    const nonAdmin = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ userId: "web-fixture-user", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
    const nonAdminToken = `${nonAdmin}.${crypto.createHmac("sha256", secret).update(nonAdmin).digest("base64url")}`;
    qualityUserToken = nonAdminToken;
    const rejected = await fetch(`${base}/api/sea/knowledge/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${nonAdminToken}` },
      body: JSON.stringify(input),
    });
    check("BFF keeps RTW non-admin 403", () => assert.equal(rejected.status, 403));
    const first = await call(path, "POST", input);
    const same = await call(path, "POST", input);
    check("BFF sends one immutable administrator fact revision and idempotent replay", () => {
      assert.equal(first.assessment, "missing");
      assert.equal(first.grade, "0");
      assert.equal(first.source_revision_id, a.revision_id);
      assert.equal(first.source_quote, quote);
      assert.equal(first.wiki_revision_id, wiki1.revision_id);
      assert.deepEqual(same, first);
    });
    const listed = await call(`${path}?limit=20`);
    const fixed = await call(`${path}/${first.fact_id}`);
    const head = await call(`modules/${module.id}/wiki-pages/climate/head`);
    const cookieHeadPath = `${base}/api/sea/knowledge/modules/${module.id}/wiki-pages/climate/head`;
    const withoutAdminCookie = await fetch(cookieHeadPath, {
      headers: { Cookie: `user_center_token=${nonAdminToken}` },
    });
    const withBothCookies = await fetch(cookieHeadPath, {
      headers: {
        Cookie: `user_center_token=${nonAdminToken}; admin_center_token=${token}`,
      },
    });
    check("BFF dual cookies deny absent admin and use the present admin identity", () => {
      assert.equal(withoutAdminCookie.status, 401);
      assert.equal(withBothCookies.status, 200);
    });
    const beforeRelease = await call(`modules/${module.id}/releases/current`);
    check(
      "fact list, fixed fact GET and editing head remain separate from published Release",
      () => {
        assert.equal(listed.items.length, 1);
        assert.equal(fixed.judge_revision_id, first.judge_revision_id);
        assert.equal(head.revision_id, wiki1.revision_id);
        assert.equal(beforeRelease.active_release_id, "");
      },
    );
    const reassessed = await call(path, "POST", {
      ...input,
      assessment: "undetermined",
      grade: "",
      base_judge_revision_id: first.judge_revision_id,
      reason: "这一条事实需要另一份原文核对，暂时不打数字分",
      idempotency_key: key(),
    });
    await call(path, "POST", { ...input, idempotency_key: key() }, 409);
    check("judgment revision CAS prevents overwriting a later human reassessment", () => {
      assert.equal(reassessed.assessment, "undetermined");
      assert.equal(reassessed.grade, "");
      assert.notEqual(reassessed.judge_revision_id, first.judge_revision_id);
    });
    report.wiki_quality = {
      wiki_revision_id: wiki1.revision_id,
      source_revision_id: a.revision_id,
      fact_id: first.fact_id,
      judge_revision_id: reassessed.judge_revision_id,
      checks: ["HTTP401", "HTTP403", "HTTP200", "idempotency", "list/get/head", "CAS409"],
    };
  }
  let catalog1;
  if (wikiFactSetMode) {
    const factPath = `modules/${module.id}/wiki-pages/climate/revisions/${wiki1.revision_id}/fact-sets`;
    const quote = "坡向影响光照。";
    const input = {
      source_revisions: [{ revision_id: a.revision_id, content_sha256: a.content_hash }],
      facts: [
        {
          source_revision_id: a.revision_id,
          locator: "paragraph:2",
          source_quote: quote,
          source_quote_sha256: crypto.createHash("sha256").update(Buffer.from(quote)).digest("hex"),
          required: true,
        },
      ],
      facts_complete: true,
      reason: "管理员声明：此固定来源范围预期覆盖这条光照事实",
      idempotency_key: key(),
    };
    await call(factPath, "POST", input, 401, false, true);
    const userRejected = await fetch(`${base}/api/sea/knowledge/${factPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${qualityUserToken}` },
      body: JSON.stringify(input),
    });
    check("FactSet BFF keeps non-admin 403", () => assert.equal(userRejected.status, 403));
    catalog1 = await call(factPath, "POST", input);
    const scopePath = `modules/${module.id}/wiki-pages/climate/fact-sets/${catalog1.source_scope_revision}`;
    const historyPath = `modules/${module.id}/wiki-pages/climate/fact-set-revisions/${catalog1.fact_set_revision_id}`;
    const scoped = await call(scopePath);
    const historical = await call(historyPath);
    const replayed = await fetch(`${base}/api/sea/knowledge/${factPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `user_center_token=${qualityUserToken}; admin_center_token=${token}`,
      },
      body: JSON.stringify(input),
    });
    const withoutAdmin = await fetch(`${base}/api/sea/knowledge/${historyPath}`, {
      headers: { Cookie: `user_center_token=${qualityUserToken}` },
    });
    check("FactSet dual-cookie POST replays with admin and history GET refuses User-only", () => {
      assert.equal(replayed.status, 200);
      assert.equal(withoutAdmin.status, 401);
    });
    const editing = await call(`modules/${module.id}/wiki-pages/climate/head`);
    const releasePointer = await call(`modules/${module.id}/releases/current`);
    const fixedSource = await call(`modules/${module.id}/revisions/${a.revision_id}`);
    const original = Buffer.from(fixedSource.content);
    check(
      "FactSet freezes immutable required Fact, same scope/history, without Wiki or Release writes",
      () => {
        assert.equal(catalog1.wiki_revision_id, wiki1.revision_id);
        assert.equal(catalog1.source_revisions.length, 1);
        assert.equal(catalog1.facts.length, 1);
        assert.equal(catalog1.facts[0].required, true);
        assert.equal(catalog1.facts[0].source_quote, quote);
        assert.equal(crypto.createHash("sha256").update(original).digest("hex"), a.content_hash);
        assert.equal(
          catalog1.facts[0].source_byte_start,
          String(original.indexOf(Buffer.from(quote))),
        );
        assert.equal(
          catalog1.facts[0].source_byte_end,
          String(original.indexOf(Buffer.from(quote)) + Buffer.byteLength(quote)),
        );
        assert.equal(catalog1.actor_id, "web-fixture-admin");
        assert.equal(scoped.fact_set_revision_id, catalog1.fact_set_revision_id);
        assert.equal(historical.fact_set_jcs_sha256, catalog1.fact_set_jcs_sha256);
        assert.equal(editing.revision_id, wiki1.revision_id);
        assert.equal(releasePointer.active_release_id, "");
      },
    );
  }
  const r1 = await release(module, [a], wiki1);
  const state0 = await call(`modules/${module.id}/releases/current`);
  check("frozen candidate is NOT_BUILT and never automatically published", () => {
    assert.equal(state0.build_state, "NOT_BUILT");
    assert.equal(state0.active_release_id, "");
  });
  const abandoned = await call(`releases/${r1.release_id}/index-builds`, "POST", {
    idempotency_key: key(),
  });
  const cancelled = await call(`releases/${r1.release_id}/index-builds`, "POST", {
    idempotency_key: key(),
  });
  const cancellation = await call(`builds/${cancelled.build_id}/cancel`, "POST", {
    reason: "隔离取消验收",
    idempotency_key: key(),
  });
  check("build cancellation is preserved", () => assert.equal(cancellation.state, "CANCELLED"));
  const b1 = await ready(r1);
  let pointer = await call(`modules/${module.id}/activation`, "PUT", {
    release_id: r1.release_id,
    build_id: b1.build_id,
    expected_pointer_revision: 0,
    reason: "结构 fixture 初版发布",
    idempotency_key: key(),
  });
  const shelf = await call("modules", "GET", undefined, 200, false, true);
  check("published shelf contains only the manually activated version", () =>
    assert.equal(shelf.items.find((m) => m.id === module.id).active_release_id, r1.release_id),
  );
  const wiki2 = await createWiki(
    "山地与气候 v2",
    "## 第二版\n\n海拔与坡向共同影响气候。",
    [a],
    wiki1,
  );
  if (wikiFactSetMode) {
    const input = {
      source_revisions: catalog1.source_revisions,
      facts: catalog1.facts.map((fact) => ({
        source_revision_id: fact.source_revision_id,
        locator: fact.locator,
        source_quote: fact.source_quote,
        source_quote_sha256: fact.source_quote_sha256,
        required: fact.required,
      })),
      facts_complete: true,
      reason: "同一来源范围的新 Wiki 修订再次声明预期事实",
      base_fact_set_revision_id: catalog1.fact_set_revision_id,
      idempotency_key: key(),
    };
    const path = `modules/${module.id}/wiki-pages/climate/revisions/${wiki2.revision_id}/fact-sets`;
    const catalog2 = await call(path, "POST", input);
    const old = await call(
      `modules/${module.id}/wiki-pages/climate/fact-set-revisions/${catalog1.fact_set_revision_id}`,
    );
    const currentCatalog = await call(
      `modules/${module.id}/wiki-pages/climate/fact-sets/${catalog1.source_scope_revision}`,
    );
    const releasePointer = await call(`modules/${module.id}/releases/current`);
    check("FactSet CAS moves only same-scope head, by-ID old Wiki remains pinned", () => {
      assert.equal(catalog2.base_fact_set_revision_id, catalog1.fact_set_revision_id);
      assert.equal(catalog2.source_scope_revision, catalog1.source_scope_revision);
      assert.equal(catalog2.wiki_revision_id, wiki2.revision_id);
      assert.equal(old.wiki_revision_id, wiki1.revision_id);
      assert.equal(currentCatalog.fact_set_revision_id, catalog2.fact_set_revision_id);
      assert.equal(releasePointer.active_release_id, r1.release_id);
    });
    await call(
      path,
      "POST",
      {
        ...input,
        base_fact_set_revision_id: catalog1.fact_set_revision_id,
        idempotency_key: key(),
      },
      409,
    );
    report.wiki_fact_set = {
      source_scope_revision: catalog1.source_scope_revision,
      first_revision_id: catalog1.fact_set_revision_id,
      current_revision_id: catalog2.fact_set_revision_id,
      historical_wiki_revision_id: old.wiki_revision_id,
      current_wiki_revision_id: catalog2.wiki_revision_id,
      required_fact_id: catalog1.facts[0].fact_id,
      actor_id: catalog1.actor_id,
      checks: [
        "HTTP401",
        "HTTP403",
        "HTTP200",
        "dual-cookie",
        "scope",
        "by-ID history",
        "CAS409",
        "byte-span",
        "head/release separation",
      ],
    };
  }
  const r2 = await release(module, [a], wiki2);
  const b2 = await ready(r2);
  const activation2 = {
    release_id: r2.release_id,
    build_id: b2.build_id,
    expected_pointer_revision: pointer.pointer_revision,
    reason: "结构 fixture 修订解读",
    idempotency_key: key(),
  };
  pointer = await call(`modules/${module.id}/activation`, "PUT", activation2);
  const replay = await call(`modules/${module.id}/activation`, "PUT", activation2);
  check("BFF duplicate activation replays the same business result", () =>
    assert.deepEqual(replay, pointer),
  );
  await call(
    `modules/${module.id}/activation`,
    "PUT",
    { ...activation2, expected_pointer_revision: 0, idempotency_key: key() },
    409,
  );
  const afterConflict = await call(`modules/${module.id}/releases/current`);
  check("stale publication returns 409 and preserves current pointer", () =>
    assert.equal(afterConflict.active_release_id, r2.release_id),
  );
  const bookB = await source(module, "书 B 原文", "迎风坡受到地形抬升降水的影响。");
  const wiki3 = await createWiki(
    "山地与气候 v3",
    "## 第三版\n\n海拔影响温度。迎风坡受到地形抬升降水的影响。编辑补充迎风与背风差异。",
    [a, bookB],
    wiki2,
  );
  let multiSourceCatalog = null;
  let multiSourceJudgments = [];
  if (wikiFactSetMode) {
    const expectedFacts = [
      { source: a, quote: "海拔影响温度。" },
      { source: bookB, quote: "迎风坡受到地形抬升降水的影响。" },
    ];
    const sourceRevisions = expectedFacts
      .map(({ source: item }) => ({
        revision_id: item.revision_id,
        content_sha256: item.content_hash,
      }))
      .sort((left, right) =>
        left.revision_id < right.revision_id ? -1 : left.revision_id > right.revision_id ? 1 : 0,
      );
    const catalogPath = `modules/${module.id}/wiki-pages/climate/revisions/${wiki3.revision_id}/fact-sets`;
    const beforeCatalog = await call(`modules/${module.id}/releases/current`);
    multiSourceCatalog = await call(catalogPath, "POST", {
      source_revisions: sourceRevisions,
      facts: expectedFacts.map(({ source: item, quote }) => ({
        source_revision_id: item.revision_id,
        locator: "paragraph:1",
        source_quote: quote,
        source_quote_sha256: crypto.createHash("sha256").update(Buffer.from(quote)).digest("hex"),
        required: true,
      })),
      facts_complete: true,
      reason: "隔离管理员声明：人工第三版须同时覆盖书A与书B的两条固定事实",
      idempotency_key: key(),
    });
    const judgmentPath = `modules/${module.id}/wiki-pages/climate/revisions/${wiki3.revision_id}/quality-judgments`;
    for (const { source: item, quote } of expectedFacts) {
      multiSourceJudgments.push(
        await call(judgmentPath, "POST", {
          source_revision_id: item.revision_id,
          source_content_sha256: item.content_hash,
          locator: "paragraph:1",
          source_quote: quote,
          source_quote_sha256: crypto.createHash("sha256").update(Buffer.from(quote)).digest("hex"),
          wiki_claim_text: quote,
          wiki_claim_sha256: crypto.createHash("sha256").update(Buffer.from(quote)).digest("hex"),
          assessment: "covered",
          grade: "3",
          rubric_version: "sea.wiki.fact-coverage.v1",
          reason: "隔离管理员主张：此版正文逐字包含本资料事实，真人质量另验",
          idempotency_key: key(),
        }),
      );
    }
    const editing = await call(`modules/${module.id}/wiki-pages/climate/head`);
    const stillUnpublished = await call(`modules/${module.id}/releases/current`);
    const fixedCatalog = await call(
      `modules/${module.id}/wiki-pages/climate/fact-set-revisions/${multiSourceCatalog.fact_set_revision_id}`,
    );
    const originals = await Promise.all(
      expectedFacts.map(({ source: item }) =>
        call(`modules/${module.id}/revisions/${item.revision_id}`),
      ),
    );
    check(
      "manual two-source Wiki freezes two original facts and separate labels without publishing",
      () => {
        assert.equal(multiSourceCatalog.wiki_revision_id, wiki3.revision_id);
        assert.equal(multiSourceCatalog.source_revisions.length, 2);
        assert.equal(multiSourceCatalog.facts.length, 2);
        assert.equal(multiSourceJudgments.length, 2);
        assert.equal(new Set(multiSourceJudgments.map((item) => item.fact_id)).size, 2);
        assert.equal(fixedCatalog.fact_set_jcs_sha256, multiSourceCatalog.fact_set_jcs_sha256);
        assert.equal(editing.revision_id, wiki3.revision_id);
        assert.equal(stillUnpublished.active_release_id, beforeCatalog.active_release_id);
        expectedFacts.forEach(({ source: item, quote }, index) => {
          const original = Buffer.from(originals[index].content);
          const fact = multiSourceCatalog.facts.find(
            (candidate) => candidate.source_revision_id === item.revision_id,
          );
          const label = multiSourceJudgments.find(
            (candidate) => candidate.source_revision_id === item.revision_id,
          );
          assert.equal(
            crypto.createHash("sha256").update(original).digest("hex"),
            item.content_hash,
          );
          assert.equal(fact.source_quote, quote);
          assert.equal(fact.source_byte_start, String(original.indexOf(Buffer.from(quote))));
          assert.equal(
            fact.source_byte_end,
            String(original.indexOf(Buffer.from(quote)) + Buffer.byteLength(quote)),
          );
          assert.equal(label.fact_id, fact.fact_id);
          assert.equal(label.wiki_revision_id, wiki3.revision_id);
          assert.equal(label.assessment, "covered");
          assert.equal(label.grade, "3");
        });
      },
    );
  }
  const r3 = await release(module, [a, bookB], wiki3);
  const b3 = await ready(r3);
  pointer = await call(`modules/${module.id}/activation`, "PUT", {
    release_id: r3.release_id,
    build_id: b3.build_id,
    expected_pointer_revision: pointer.pointer_revision,
    reason: "结构 fixture 加入书 B",
    idempotency_key: key(),
  });
  if (wikiFactSetMode) {
    const wiki3Original = await call(`modules/${module.id}/revisions/${wiki3.revision_id}`);
    const fixedPublicWiki = await call(
      `modules/${module.id}/releases/${r3.release_id}/revisions/${wiki3.revision_id}`,
      "GET",
      undefined,
      200,
      false,
      true,
    );
    const fixedPublicSources = await Promise.all(
      [a, bookB].map((item) =>
        call(
          `modules/${module.id}/releases/${r3.release_id}/revisions/${item.revision_id}`,
          "GET",
          undefined,
          200,
          false,
          true,
        ),
      ),
    );
    check(
      "manual release publishes the same two-source Wiki and keeps its original facts pinned",
      () => {
        assert.equal(pointer.active_release_id, r3.release_id);
        assert.equal(fixedPublicWiki.content, wiki3Original.content);
        assert.equal(
          crypto.createHash("sha256").update(Buffer.from(wiki3Original.content)).digest("hex"),
          wiki3.content_hash,
        );
        assert.ok(fixedPublicWiki.content.includes("海拔影响温度。"));
        assert.ok(fixedPublicWiki.content.includes("迎风坡受到地形抬升降水的影响。"));
        assert.equal(fixedPublicSources[0].content, "海拔影响温度。\n\n坡向影响光照。");
        assert.equal(fixedPublicSources[1].content, "迎风坡受到地形抬升降水的影响。");
      },
    );
    report.wiki_fact_set.multi_source_revision_id = multiSourceCatalog.fact_set_revision_id;
    report.wiki_fact_set.multi_source_fact_ids = multiSourceCatalog.facts.map(
      (item) => item.fact_id,
    );
    report.wiki_fact_set.multi_source_label_event_ids = multiSourceJudgments.map(
      (item) => item.event_id,
    );
  }
  check("book A, revised interpretation, and book B create three immutable releases", () =>
    assert.equal(pointer.pointer_revision, 3),
  );
  pointer = await call(`modules/${module.id}/activation`, "PUT", {
    release_id: r1.release_id,
    build_id: b1.build_id,
    expected_pointer_revision: pointer.pointer_revision,
    reason: "结构 fixture 回滚初版",
    idempotency_key: key(),
  });
  check("rollback uses an older READY build and increases the pointer revision", () => {
    assert.equal(pointer.active_release_id, r1.release_id);
    assert.equal(pointer.pointer_revision, 4);
  });
  const compileInput = {
    page_id: "pending-fixture",
    source_revision_ids: [a.revision_id],
    guidance: "结构 fixture 等待实际 worker，不声称已完成",
    idempotency_key: key(),
  };
  const compile1 = await call(`modules/${module.id}/compiles`, "POST", compileInput);
  const compile2 = await call(`modules/${module.id}/compiles`, "POST", {
    ...compileInput,
    idempotency_key: key(),
  });
  await call(`compiles/${compile2.compile_id}/cancel`, "POST", {
    reason: "编制取消验收",
    idempotency_key: key(),
  });
  await call(`modules/${module.id}/compiles`, "POST", { ...compileInput, idempotency_key: key() });
  const draftDetail = await call(`workbench/modules/${module.id}`);
  check("administrator module detail survives reload", () =>
    assert.equal(draftDetail.id, module.id),
  );
  const revisionPage = await call(`modules/${module.id}/revisions?limit=1`);
  const sourceBody = await call(`modules/${module.id}/revisions/${a.revision_id}`);
  const wikiBody = await call(`modules/${module.id}/revisions/${wiki2.revision_id}`);
  check("revision lists are paged and immutable editor bodies are read separately", () => {
    assert.equal(revisionPage.items.length, 1);
    assert.ok(revisionPage.next_cursor);
    assert.equal(sourceBody.content, "海拔影响温度。\n\n坡向影响光照。");
    assert.ok(wikiBody.content.includes("第二版"));
    assert.equal(
      crypto.createHash("sha256").update(sourceBody.content).digest("hex"),
      sourceBody.content_hash,
    );
    assert.equal(
      crypto.createHash("sha256").update(wikiBody.content).digest("hex"),
      wikiBody.content_hash,
    );
  });
  const historyBuilds = await call(`modules/${module.id}/builds?limit=100`);
  const historyCompiles = await call(`modules/${module.id}/compiles?limit=100`);
  check("reloaded history retains READY CANCELLED SUPERSEDED and pending states", () => {
    assert.equal(
      historyBuilds.items.find((b) => b.build_id === abandoned.build_id).state,
      "SUPERSEDED",
    );
    assert.equal(
      historyBuilds.items.find((b) => b.build_id === cancelled.build_id).state,
      "CANCELLED",
    );
    assert.equal(historyBuilds.items.find((b) => b.build_id === b1.build_id).state, "READY");
    assert.equal(
      historyCompiles.items.find((c) => c.compile_id === compile1.compile_id).state,
      "SUPERSEDED",
    );
    assert.ok(historyCompiles.items.some((c) => c.state === "CANCELLED"));
    assert.ok(historyCompiles.items.some((c) => c.state === "BUILDING"));
  });
  await call(`modules/${module.id}/builds/${b1.build_id}`);
  await call(`modules/${module.id}/compiles/${compile1.compile_id}`);
  const historical = await call(
    `modules/${module.id}/published-releases/${r2.release_id}`,
    "GET",
    undefined,
    200,
    false,
    true,
  );
  const historicalBody = await call(
    `modules/${module.id}/releases/${r2.release_id}/revisions/${wiki2.revision_id}`,
    "GET",
    undefined,
    200,
    false,
    true,
  );
  const publicRevisions = await call(
    `modules/${module.id}/releases/${r2.release_id}/revisions?limit=1`,
    "GET",
    undefined,
    200,
    false,
    true,
  );
  check("public historical body remains pinned after rollback and metadata lists are paged", () => {
    assert.equal(historical.release_id, r2.release_id);
    assert.equal(historicalBody.content, wikiBody.content);
    assert.equal(publicRevisions.items.length, 1);
    assert.ok(publicRevisions.next_cursor);
  });
  await call(
    `modules/${module.id}/releases/${r1.release_id}/revisions/${bookB.revision_id}`,
    "GET",
    undefined,
    404,
    false,
    true,
  );
  const firstPage = await call(`modules/${module.id}/releases?limit=1`);
  const neverPublished = await release(module, [a, bookB], wiki3);
  const seen = [firstPage.items[0].release_id];
  let cursor = firstPage.next_cursor;
  while (cursor) {
    const page = await call(
      `modules/${module.id}/releases?limit=1&cursor=${encodeURIComponent(cursor)}`,
    );
    seen.push(...page.items.map((r) => r.release_id));
    cursor = page.next_cursor;
  }
  check("opaque cursor preserves membership when later candidates are added", () => {
    assert.equal(new Set(seen).size, 3);
    assert.equal(seen.includes(neverPublished.release_id), false);
  });
  await call(
    `modules/${module.id}/published-releases/${neverPublished.release_id}`,
    "GET",
    undefined,
    404,
    false,
    true,
  );
  await call(
    `modules/${module.id}/releases/${neverPublished.release_id}/revisions/${wiki3.revision_id}`,
    "GET",
    undefined,
    404,
    false,
    true,
  );
  check("unpublished releases and nonmembers cannot be read as public evidence", () =>
    assert.ok(neverPublished.release_id),
  );
  const withdrawnModule = await call("modules", "POST", {
    title: "撤回规则 · 隔离 fixture",
    idempotency_key: key(),
  });
  const withdrawnSource = await source(withdrawnModule, "撤回资料", "该资料仅用于撤回规则验收。");
  const withdrawnWiki = await call(
    `modules/${withdrawnModule.id}/wiki-pages/withdrawn/revisions`,
    "POST",
    {
      title: "撤回知识",
      content: "必须保留明确不可用状态。",
      source_refs: [{ revision_id: withdrawnSource.revision_id, locator: "paragraph:1" }],
      idempotency_key: key(),
    },
  );
  let withdrawnFactPath = "";
  let withdrawnFact = null;
  let withdrawnCatalog = null;
  if (wikiQualityMode) {
    const quote = "该资料仅用于撤回规则验收。";
    withdrawnFactPath = `modules/${withdrawnModule.id}/wiki-pages/withdrawn/revisions/${withdrawnWiki.revision_id}/quality-judgments`;
    withdrawnFact = await call(withdrawnFactPath, "POST", {
      source_revision_id: withdrawnSource.revision_id,
      source_content_sha256: withdrawnSource.content_hash,
      locator: "paragraph:1",
      source_quote: quote,
      source_quote_sha256: crypto.createHash("sha256").update(Buffer.from(quote)).digest("hex"),
      assessment: "missing",
      grade: "0",
      rubric_version: "sea.wiki.fact-coverage.v1",
      reason: "撤回前记录固定原文事实在这一版 Wiki 中缺失",
      idempotency_key: key(),
    });
  }
  if (wikiFactSetMode) {
    const quote = "该资料仅用于撤回规则验收。";
    withdrawnCatalog = await call(
      `modules/${withdrawnModule.id}/wiki-pages/withdrawn/revisions/${withdrawnWiki.revision_id}/fact-sets`,
      "POST",
      {
        source_revisions: [
          {
            revision_id: withdrawnSource.revision_id,
            content_sha256: withdrawnSource.content_hash,
          },
        ],
        facts: [
          {
            source_revision_id: withdrawnSource.revision_id,
            locator: "paragraph:1",
            source_quote: quote,
            source_quote_sha256: crypto
              .createHash("sha256")
              .update(Buffer.from(quote))
              .digest("hex"),
            required: true,
          },
        ],
        facts_complete: true,
        reason: "撤回前的固定来源预期事实，仅供目录历史回读",
        idempotency_key: key(),
      },
    );
  }
  const withdrawnRelease = await release(withdrawnModule, [withdrawnSource], withdrawnWiki);
  const withdrawnBuild = await ready(withdrawnRelease);
  await call(`modules/${withdrawnModule.id}/activation`, "PUT", {
    release_id: withdrawnRelease.release_id,
    build_id: withdrawnBuild.build_id,
    expected_pointer_revision: 0,
    reason: "撤回规则结构fixture",
    idempotency_key: key(),
  });
  await call(`modules/${withdrawnModule.id}/withdrawals`, "POST", {
    target_kind: "revision",
    target_id: withdrawnSource.revision_id,
    reason: "验证正式内容撤回",
    idempotency_key: key(),
  });
  if (wikiQualityMode) {
    await call(
      `modules/${withdrawnModule.id}/revisions/${withdrawnSource.revision_id}`,
      "GET",
      undefined,
      410,
    );
    const retained = await call(`${withdrawnFactPath}?limit=20`);
    check(
      "withdrawn Source body is unavailable while its earlier fixed fact label remains listed",
      () => {
        assert.equal(retained.items.length, 1);
        assert.equal(retained.items[0].fact_id, withdrawnFact.fact_id);
        assert.equal(retained.items[0].source_revision_id, withdrawnSource.revision_id);
      },
    );
    report.wiki_quality.withdrawn_fact_id = withdrawnFact.fact_id;
    report.wiki_quality.withdrawn_module_id = withdrawnModule.id;
  }
  if (wikiFactSetMode) {
    const retainedCatalog = await call(
      `modules/${withdrawnModule.id}/wiki-pages/withdrawn/fact-set-revisions/${withdrawnCatalog.fact_set_revision_id}`,
    );
    check(
      "withdrawn original Source GET remains 410 while its immutable FactSet history is readable",
      () => {
        assert.equal(retainedCatalog.fact_set_revision_id, withdrawnCatalog.fact_set_revision_id);
        assert.equal(retainedCatalog.facts[0].source_quote, "该资料仅用于撤回规则验收。");
        assert.equal(retainedCatalog.facts[0].source_revision_id, withdrawnSource.revision_id);
      },
    );
    report.wiki_fact_set.withdrawn_catalog_revision_id = withdrawnCatalog.fact_set_revision_id;
  }
  await call(
    `modules/${withdrawnModule.id}/releases/${withdrawnRelease.release_id}/revisions/${withdrawnWiki.revision_id}`,
    "GET",
    undefined,
    410,
    false,
    true,
  );
  await call(
    `modules/${withdrawnModule.id}/published-releases/${withdrawnRelease.release_id}`,
    "GET",
    undefined,
    410,
    false,
    true,
  );
  check(
    "withdrawn release members make public history return 410 rather than another revision",
    () => assert.ok(withdrawnSource.revision_id),
  );
  report.fixture = {
    module_id: module.id,
    unpublished_release: neverPublished.release_id,
    withdrawn_module: withdrawnModule.id,
    withdrawn_release: withdrawnRelease.release_id,
    withdrawn_wiki: withdrawnWiki.revision_id,
    source_a: a.revision_id,
    source_b: bookB.revision_id,
    wiki1: wiki1.revision_id,
    wiki2: wiki2.revision_id,
    wiki3: wiki3.revision_id,
    release1: r1.release_id,
    release2: r2.release_id,
    release3: r3.release_id,
    build1: b1.build_id,
    build2: b2.build_id,
    build3: b3.build_id,
    superseded_build: abandoned.build_id,
    cancelled_build: cancelled.build_id,
    superseded_compile: compile1.compile_id,
  };
  // Session handoff is test-only in this disposable process, never shipped in the product.
  bootstrap = http.createServer((req, res) => {
    if (req.url !== "/session" && !(wikiQualityMode && req.url === "/session/quality-dual")) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(302, {
      "Set-Cookie":
        req.url === "/session/quality-dual"
          ? [
              `user_center_token=${qualityUserToken}; Path=/; SameSite=Lax; Max-Age=3600`,
              `admin_center_token=${token}; Path=/; SameSite=Lax; Max-Age=3600`,
            ]
          : `user_center_token=${token}; Path=/; SameSite=Lax; Max-Age=3600`,
      Location: `${base}/knowledge/${module.id}/workbench`,
    });
    res.end();
  });
  await new Promise((resolve) => bootstrap.listen(sessionPort, "127.0.0.1", resolve));
  report.completed_at = new Date().toISOString();
  report.web_url = base;
  report.api_url = upstream;
  report.browser_session_url = `http://127.0.0.1:${sessionPort}/session`;
  if (wikiQualityMode)
    report.browser_quality_dual_session_url = `http://127.0.0.1:${sessionPort}/session/quality-dual`;
  report.evidence_directory = dir;
  fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (process.env.KNOWLEDGE_KEEP_RUNNING === "1") await new Promise(() => {});
  else cleanup();
})().catch((error) => {
  report.error = error.stack;
  console.error(error);
  cleanup();
  console.error(`Evidence: ${dir}`);
  process.exitCode = 1;
});
