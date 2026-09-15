const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const file = path.join(__dirname, "../src/features/knowledge/quality-source.ts");
const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  fileName: file,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const transformed = { exports: {} };
new Function("require", "module", "exports", compiled)(require, transformed, transformed.exports);
const { originalSourceParagraph, sha256Utf8 } = transformed.exports;

test("review source quote keeps original CRLF, spaces and Unicode", () => {
  const source = "前言\r\n\r\n 第一事实\r\n第二行  \r\n\r\n  \r\n\r\n第三事实";
  assert.equal(originalSourceParagraph(source, "paragraph:2"), " 第一事实\r\n第二行  ");
  assert.equal(originalSourceParagraph(source, "paragraph:3"), "第三事实");
  assert.equal(originalSourceParagraph(source, "paragraph:0"), null);
  assert.equal(originalSourceParagraph(source, "paragraph:02"), null);
  assert.equal(originalSourceParagraph(source, "paragraph:4"), null);
});

test("review quote SHA is calculated from original UTF-8 bytes", async () => {
  const quote = " 第一事实\r\n第二行  ";
  assert.equal(
    await sha256Utf8(quote),
    require("node:crypto").createHash("sha256").update(Buffer.from(quote, "utf8")).digest("hex"),
  );
});
