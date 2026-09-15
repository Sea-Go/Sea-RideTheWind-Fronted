import type { Compile, FactSetSourceRevision, Revision } from "./api";
import { sha256Utf8 } from "./quality-source";

export type FactSetScopePreview = {
  wiki: Revision;
  originCompileId: string;
  sources: Revision[];
  sourceRevisions: FactSetSourceRevision[];
  sourceScopeRevision: string;
};

type Readers = {
  revision: (id: string) => Promise<Revision>;
  compile: (id: string) => Promise<Compile>;
  knownRevisions?: Revision[];
};

/** Mirrors the approved RTW scope, while RTW remains the final validator. */
export async function previewFactSetScope(
  moduleId: string,
  pageId: string,
  wikiRevisionId: string,
  readers: Readers,
): Promise<FactSetScopePreview> {
  let wiki = await readers.revision(wikiRevisionId);
  if (
    wiki.kind !== "wiki" ||
    wiki.module_id !== moduleId ||
    wiki.entity_id !== pageId ||
    wiki.withdrawn ||
    typeof wiki.content !== "string" ||
    (await sha256Utf8(wiki.content)) !== wiki.content_hash
  )
    throw new Error("固定 Wiki 修订已撤回、身份或原字节 SHA-256 不符，不能声明目录。");
  const target = wiki;
  const known = new Map(
    readers.knownRevisions?.map((revision) => [revision.revision_id, revision]),
  );
  const sourceIDs = new Set<string>();
  const currentRefs = new Set(target.source_refs.map((ref) => ref.revision_id));
  const seenWiki = new Set<string>();
  let originCompileId = "";
  for (let depth = 0; depth < 64; depth++) {
    if (seenWiki.has(wiki.revision_id)) throw new Error("Wiki 来源链循环，不能声明目录。");
    seenWiki.add(wiki.revision_id);
    if (wiki.kind !== "wiki" || wiki.module_id !== moduleId || wiki.entity_id !== pageId)
      throw new Error("Wiki 来源链跨页面，不能声明目录。");
    if (!target.created_by.startsWith("btw.compile/"))
      for (const ref of wiki.source_refs) sourceIDs.add(ref.revision_id);
    if (wiki.created_by.startsWith("btw.compile/")) {
      const compileId = wiki.created_by.slice("btw.compile/".length);
      const compile = await readers.compile(compileId);
      if (
        compile.state !== "ACCEPTED" ||
        compile.module_id !== moduleId ||
        compile.page_id !== pageId ||
        compile.revision_id !== wiki.revision_id ||
        !compile.source_revision_ids.length
      )
        throw new Error("AI Wiki 对应的已接纳编制及完整来源范围不可核对。");
      for (const sourceId of compile.source_revision_ids) sourceIDs.add(sourceId);
      if (wiki.revision_id === target.revision_id) originCompileId = compileId;
    }
    if (!target.created_by.startsWith("btw.compile/") && wiki.base_revision_id) {
      wiki = known.get(wiki.base_revision_id) || (await readers.revision(wiki.base_revision_id));
      continue;
    }
    break;
  }
  if (wiki.base_revision_id && !target.created_by.startsWith("btw.compile/") && seenWiki.size >= 64)
    throw new Error("Wiki 来源链超出 64 层，不能声明目录。");
  const sources: Revision[] = [];
  for (const id of [...sourceIDs].sort()) {
    const metadata = known.get(id);
    if (metadata?.withdrawn) {
      if (currentRefs.has(id) || originCompileId)
        throw new Error(
          `当前 Wiki 或 AI 编制引用的原文 ${id} 已撤回，不能创建新目录；可按目录修订 ID 查看历史。`,
        );
      continue;
    }
    let source: Revision;
    try {
      source = await readers.revision(id);
    } catch {
      throw new Error(
        `来源修订 ${id} 的正文不可取；不能省略后继续声明。请加载历史来源元数据，或按目录修订 ID 查看旧目录。`,
      );
    }
    if (source.kind !== "source" || source.module_id !== moduleId)
      throw new Error(`来源 ${id} 不属于当前模块。`);
    if (source.withdrawn) {
      if (currentRefs.has(id) || originCompileId)
        throw new Error(`当前 Wiki 或 AI 编制引用的来源 ${id} 已撤回。`);
      continue; // Only an explicitly withdrawn manual ancestor leaves a new scope.
    }
    if (
      typeof source.content !== "string" ||
      (source.media_type !== "text/plain" && source.media_type !== "text/markdown") ||
      source.content.includes("\u0000") ||
      (await sha256Utf8(source.content)) !== source.content_hash
    )
      throw new Error(`来源 ${id} 的原字节与固定 SHA-256 不符。`);
    sources.push(source);
  }
  if (!sources.length || sources.length > 64)
    throw new Error("完整有效来源范围必须有 1–64 份原文。");
  const sourceRevisions = sources.map((source) => ({
    revision_id: source.revision_id,
    content_sha256: source.content_hash,
  }));
  // RFC 8785 JCS key order for this fixed strings-only RTW scope contract.
  const canonical = `{"module_id":${JSON.stringify(moduleId)},"page_id":${JSON.stringify(pageId)},"source_revisions":[${sourceRevisions
    .map(
      (source) =>
        `{"content_sha256":${JSON.stringify(source.content_sha256)},"revision_id":${JSON.stringify(source.revision_id)}}`,
    )
    .join(",")}]}`;
  return {
    wiki: target,
    originCompileId,
    sources,
    sourceRevisions,
    sourceScopeRevision: `scope_${await sha256Utf8(canonical)}`,
  };
}

export function sourceParagraphForFact(source: Revision, locator: string): string | null {
  return originalFactSpan(source, locator)?.paragraph || null;
}

/** RTW citationParagraph's CRLF location mapping, retaining original UTF-8 bytes. */
export function originalFactSpan(
  source: Revision,
  locator: string,
  quote = "",
): { paragraph: string; start: number; end: number } | null {
  if (typeof source.content !== "string") return null;
  const match = /^paragraph:([1-9]\d*)$/.exec(locator);
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
  const original = new TextEncoder().encode(source.content);
  const normalized: number[] = [];
  const positions: number[] = [];
  for (let i = 0; i < original.length; i++) {
    positions.push(i);
    if (original[i] === 13 && original[i + 1] === 10) {
      i++;
      normalized.push(10);
    } else normalized.push(original[i]);
  }
  positions.push(original.length);
  let start = 0;
  let ordinal = 0;
  for (let i = 0; i <= normalized.length; i++) {
    if (i !== normalized.length && !(normalized[i] === 10 && normalized[i + 1] === 10)) continue;
    const end = i;
    const block = new TextDecoder().decode(new Uint8Array(normalized.slice(start, end)));
    if (block.trim()) {
      ordinal++;
      if (ordinal === Number(match[1])) {
        const originalStart = positions[start];
        const originalEnd = positions[end];
        const paragraph = new TextDecoder().decode(original.slice(originalStart, originalEnd));
        if (!quote) return { paragraph, start: originalStart, end: originalEnd };
        const needle = new TextEncoder().encode(quote);
        if (!needle.length) return null;
        for (let j = originalStart; j + needle.length <= originalEnd; j++) {
          if (needle.every((byte, k) => byte === original[j + k]))
            return { paragraph, start: j, end: j + needle.length };
        }
        return null;
      }
    }
    start = end + 2;
    i++;
  }
  return null;
}

export async function previewFactID(sourceId: string, locator: string, quote: string) {
  const quoteSHA = await sha256Utf8(quote);
  return `fact_${await sha256Utf8(`${sourceId}\u0000${locator}\u0000${quoteSHA}`)}`;
}
