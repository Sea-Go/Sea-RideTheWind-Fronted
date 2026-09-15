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
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
const { knowledgeAdminRequest, knowledgeRequest } = require("../src/features/knowledge/api.ts");

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
  await knowledgeRequest("modules/m1/revisions/r1");
  await knowledgeAdminRequest("modules/m1/wiki-pages/p1/head");
  assert.deepEqual(auth, ["Bearer user-fixture", "Bearer admin-fixture"]);
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
