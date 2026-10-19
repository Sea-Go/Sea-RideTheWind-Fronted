#!/usr/bin/env node
// G6 巨型文件 ratchet（治理基线 G6，前端版）：
// src/tests/scripts 下 ts/tsx/cjs/mjs 默认上限 600 行；超限文件必须登记
// size_allowlist.json 且只减不增。三种红：未登记超限 / 超记录值 / 幽灵条目。
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const LIMIT = 600;
const SCAN_DIRS = ["src", "tests", "scripts"];
const EXTS = [".ts", ".tsx", ".cjs", ".mjs"];
const SKIP = new Set(["node_modules", ".next", "dist", "generated", "coverage"]);

const allow = JSON.parse(readFileSync(join(ROOT, "size_allowlist.json"), "utf8"));
const files = allow.files ?? {};

function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP.has(name)) walk(p, out);
    } else if (EXTS.some((e) => name.endsWith(e))) {
      out.push(p);
    }
  }
}

const all = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), all);

const errors = [];
const seen = new Set();
for (const p of all) {
  const rel = relative(ROOT, p).split(sep).join("/");
  const lines = readFileSync(p, "utf8").split("\n").length;
  if (rel in files) {
    seen.add(rel);
    if (lines > files[rel]) {
      errors.push(`[只增不减] ${rel} ${lines} > 记录 ${files[rel]}（G6）`);
    }
  } else if (lines > LIMIT) {
    errors.push(`[新增超限] ${rel} ${lines} > ${LIMIT} 且未登记白名单（G6）`);
  }
}
for (const rel of Object.keys(files)) {
  if (!seen.has(rel)) errors.push(`[白名单过期] ${rel} 已不存在，请删除条目（G6）`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`fileratchet ok: ${all.length} files scanned, ${Object.keys(files).length} grandfathered`);
