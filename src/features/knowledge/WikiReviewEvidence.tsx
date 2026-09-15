"use client";
import { useEffect, useState } from "react";

import { Notice } from "@/features/sea/components/primitives";

import { knowledgeRead, type Revision } from "./api";
import { originalSourceParagraph, sha256Utf8 } from "./quality-source";

export type WikiReviewEvidence = {
  wiki: Revision;
  source: Revision;
  locator: string;
  sourceQuote: string;
  wikiClaim: string;
};

export function WikiReviewEvidencePicker({
  moduleId,
  revisions,
  busy,
  onEdit,
  onSelect,
}: {
  moduleId: string;
  revisions: Revision[];
  busy: boolean;
  onEdit: () => void;
  onSelect: (evidence: WikiReviewEvidence) => void;
}) {
  const [wikiId, setWikiId] = useState("");
  const [wiki, setWiki] = useState<Revision | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [source, setSource] = useState<Revision | null>(null);
  const [locator, setLocator] = useState("paragraph:1");
  const [sourceQuote, setSourceQuote] = useState("");
  const [wikiClaim, setWikiClaim] = useState("");
  const [error, setError] = useState("");
  const [wikiReading, setWikiReading] = useState(false);
  const [sourceReading, setSourceReading] = useState(false);
  const wikiChoices = revisions.filter((revision) => revision.kind === "wiki");
  const knownSource = new Map<string, Revision | null>(
    revisions
      .filter((revision) => revision.kind === "source")
      .map((revision) => [revision.revision_id, revision]),
  );
  for (const ref of wiki?.source_refs || []) {
    if (!knownSource.has(ref.revision_id)) knownSource.set(ref.revision_id, null);
  }

  useEffect(() => {
    if (!wikiId) return;
    const controller = new AbortController();
    knowledgeRead
      .revision(moduleId, wikiId, controller.signal)
      .then(async (revision) => {
        if (
          revision.kind !== "wiki" ||
          revision.module_id !== moduleId ||
          typeof revision.content !== "string" ||
          (await sha256Utf8(revision.content)) !== revision.content_hash
        )
          throw new Error("固定 Wiki 原文与修订 hash 不一致，停止人审。");
        if (controller.signal.aborted) return;
        setWiki(revision);
        if (revision.source_refs?.length === 1) {
          setSourceReading(true);
          setSourceId(revision.source_refs[0].revision_id);
          setLocator(revision.source_refs[0].locator);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "固定 Wiki 原文读取失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setWikiReading(false);
      });
    return () => controller.abort();
  }, [moduleId, wikiId]);

  useEffect(() => {
    if (!wiki || !sourceId) return;
    const controller = new AbortController();
    knowledgeRead
      .revision(moduleId, sourceId, controller.signal)
      .then(async (revision) => {
        if (
          revision.kind !== "source" ||
          revision.module_id !== moduleId ||
          typeof revision.content !== "string" ||
          (await sha256Utf8(revision.content)) !== revision.content_hash
        )
          throw new Error("固定原文与修订 hash 不一致，停止人审。");
        if (controller.signal.aborted) return;
        setSource(revision);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "固定原文读取失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSourceReading(false);
      });
    return () => controller.abort();
  }, [moduleId, wiki, sourceId]);

  const paragraph = source?.content ? originalSourceParagraph(source.content, locator) : null;
  const quoteValid = Boolean(
    paragraph &&
    sourceQuote.trim() &&
    new TextEncoder().encode(sourceQuote).length <= 4096 &&
    paragraph.includes(sourceQuote),
  );
  const claimValid =
    !wikiClaim ||
    Boolean(
      new TextEncoder().encode(wikiClaim).length <= 4096 && wiki?.content?.includes(wikiClaim),
    );
  const reading = wikiReading || sourceReading;

  return (
    <section className="wiki-review-evidence">
      <h2>固定修订与原文证据</h2>
      <p>从原始资料中选取事实片段，再核对这一条事实在固定 Wiki 修订中的表述。</p>
      {error && <Notice error>{error}</Notice>}
      {reading && <p role="status">正在核对固定修订正文和 SHA-256…</p>}
      <label className="sea-field">
        Wiki 修订
        <select
          value={wikiId}
          disabled={busy}
          onChange={(event) => {
            onEdit();
            const id = event.target.value;
            setWikiReading(Boolean(id));
            setSourceReading(false);
            setWikiId(id);
            setWiki(null);
            setSourceId("");
            setSource(null);
            setSourceQuote("");
            setWikiClaim("");
            setError("");
          }}
          aria-label="选择固定 Wiki 修订"
        >
          <option value="">请选择</option>
          {wikiChoices.map((revision) => (
            <option key={revision.revision_id} value={revision.revision_id}>
              {revision.title} · {revision.entity_id} · {revision.revision_id}
              {revision.withdrawn ? "（已撤回）" : ""}
            </option>
          ))}
        </select>
      </label>
      {wiki && (
        <>
          <p className="knowledge-id">
            Wiki {wiki.revision_id} · SHA-256 {wiki.content_hash}
          </p>
          <pre className="knowledge-body">{wiki.content}</pre>
          <label className="sea-field">
            对应的 Wiki 断言（缺失时留空）
            <textarea
              rows={3}
              value={wikiClaim}
              disabled={busy}
              onChange={(event) => {
                onEdit();
                setWikiClaim(event.target.value);
              }}
              maxLength={4096}
              aria-invalid={!claimValid}
              placeholder="仅从上方固定 Wiki 正文逐字复制"
            />
          </label>
          {!claimValid && <p role="alert">断言必须存在于这份固定 Wiki 原文中。</p>}
          <label className="sea-field">
            原文修订
            <select
              value={sourceId}
              disabled={busy}
              onChange={(event) => {
                onEdit();
                const id = event.target.value;
                setSourceReading(Boolean(id));
                setSourceId(id);
                setSource(null);
                setSourceQuote("");
                setError("");
                const ref = wiki.source_refs?.find((item) => item.revision_id === id);
                setLocator(ref?.locator || "paragraph:1");
              }}
              aria-label="选择固定原文修订"
            >
              <option value="">请选择</option>
              {[...knownSource].map(([id, revision]) => (
                <option key={id} value={id}>
                  {revision?.title || "历史原文"} · {id}
                  {revision?.withdrawn ? "（已撤回）" : ""}
                </option>
              ))}
            </select>
          </label>
          {source && (
            <>
              <p className="knowledge-id">
                原文 {source.revision_id} · SHA-256 {source.content_hash}
              </p>
              <label className="sea-field">
                原文段落定位
                <input
                  value={locator}
                  disabled={busy}
                  onChange={(event) => {
                    onEdit();
                    setLocator(event.target.value);
                    setSourceQuote("");
                  }}
                  placeholder="paragraph:1"
                />
              </label>
              {paragraph ? (
                <>
                  <pre className="knowledge-body">{paragraph}</pre>
                  <button
                    type="button"
                    className="sea-button"
                    disabled={busy || new TextEncoder().encode(paragraph).length > 4096}
                    onClick={() => {
                      onEdit();
                      setSourceQuote(paragraph);
                    }}
                  >
                    使用整段原文
                  </button>
                  <label className="sea-field">
                    原文事实片段
                    <textarea
                      rows={3}
                      value={sourceQuote}
                      disabled={busy}
                      onChange={(event) => {
                        onEdit();
                        setSourceQuote(event.target.value);
                      }}
                      maxLength={4096}
                      aria-invalid={Boolean(sourceQuote) && !quoteValid}
                      placeholder="仅从上方原文段落逐字复制；保留原始空格与换行"
                    />
                  </label>
                  {sourceQuote && !quoteValid && <p role="alert">事实片段必须属于这段固定原文。</p>}
                </>
              ) : (
                <Notice error>这份固定原文没有该 paragraph:N 段落。</Notice>
              )}
            </>
          )}
          <div className="sea-actions">
            <button
              type="button"
              className="sea-button"
              disabled={busy || !source || !quoteValid || !claimValid || reading}
              onClick={() => {
                if (source && quoteValid && claimValid)
                  onSelect({ wiki, source, locator, sourceQuote, wikiClaim });
              }}
            >
              使用这组固定证据
            </button>
          </div>
        </>
      )}
    </section>
  );
}
