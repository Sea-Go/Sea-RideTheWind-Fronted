const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolveFilename.call(
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
  collectCitationNumbers,
  parseSSEFrame,
} = require("../src/features/knowledge/chat-stream.ts");
const {
  CHAT_TIER_DEFS,
  HEADING_PARA_INDEX,
  LEVEL_PARAGRAPH,
  MAX_CANDIDATES,
  MAX_EVIDENCES_PER_CANDIDATE,
  MAX_QUOTE_RUNES,
  isChatTier,
} = require("../src/features/knowledge/generated/structureComponents.ts");

test("parseSSEFrame 解析 event+JSON data 帧", () => {
  const frame = 'event: message\ndata: {"id":"m1","part":{"type":"text","text":"你好"},"seq":3}';
  const parsed = parseSSEFrame(frame);
  assert.deepEqual(parsed, {
    event: "message",
    data: { id: "m1", part: { type: "text", text: "你好" }, seq: 3 },
  });
});

test("parseSSEFrame 缺 event 行默认 message，非 JSON data 原样返回", () => {
  assert.deepEqual(parseSSEFrame("data: plain"), { event: "message", data: "plain" });
  assert.deepEqual(parseSSEFrame("data: 42"), { event: "message", data: 42 });
});

test("parseSSEFrame 无 data 行返回 null（心跳/注释帧）", () => {
  assert.equal(parseSSEFrame(": keep-alive"), null);
  assert.equal(parseSSEFrame("event: done"), null);
});

test("parseSSEFrame 容忍 CRLF 行尾", () => {
  const parsed = parseSSEFrame("event: done\r\ndata: {}\r\n");
  assert.deepEqual(parsed, { event: "done", data: {} });
});

test("collectCitationNumbers 收集去重并升序的角标编号", () => {
  const numbers = collectCitationNumbers([
    {
      id: "a",
      role: "assistant",
      parts: [
        { type: "text", text: "结构树按修订冻结 [2]，Locator 指向段落 [1]。" },
        // SSE 分片边界拆开 [10]：按拼接后的完整文本仍应命中。
        { type: "text", text: "更多见 [" },
        { type: "text", text: "10] 与重复的 [2]。" },
      ],
    },
    {
      id: "u",
      role: "user",
      parts: [{ type: "text", text: "用户输入里的 [99] 不采集？采集规则按正文统一处理" }],
    },
  ]);
  assert.deepEqual(numbers, [1, 2, 10]);
});

test("契约常量与 Go 侧 evidence/types.go 对齐", () => {
  assert.equal(MAX_QUOTE_RUNES, 200);
  assert.equal(LEVEL_PARAGRAPH, 7);
  assert.equal(HEADING_PARA_INDEX, -1);
  assert.equal(MAX_CANDIDATES, 50);
  assert.equal(MAX_EVIDENCES_PER_CANDIDATE, 8);
});

test("tier 语义唯一来源：三档顺序与文案，选择器不自造", () => {
  assert.deepEqual(
    CHAT_TIER_DEFS.map((tier) => tier.id),
    ["fast", "balanced", "deep"],
  );
  assert.equal(CHAT_TIER_DEFS[0].description, "直接检索，0 次模型规划");
  assert.equal(CHAT_TIER_DEFS[1].description, "检索规划 + 精排");
  assert.equal(CHAT_TIER_DEFS[2].description, "多轮深查，逐层追问");
  assert.equal(isChatTier("fast"), true);
  assert.equal(isChatTier("turbo"), false);
  assert.equal(isChatTier(null), false);
});
