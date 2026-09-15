"use client";
import { useEffect, useRef, useState } from "react";

import { Notice } from "@/features/sea/components/primitives";

import {
  type JudgeWikiFactReq,
  knowledgeQuality,
  type Revision,
  type WikiFactJudgmentRecord,
  type WikiPageHeadSnapshot,
} from "./api";
import { sha256Utf8 } from "./quality-source";
import { CommandKeys } from "./state";
import { type WikiFactReviewDraft, WikiFactReviewForm } from "./WikiFactReviewForm";
import { type WikiReviewEvidence, WikiReviewEvidencePicker } from "./WikiReviewEvidence";

export function WikiFactQualityReview({
  moduleId,
  revisions,
  publishedReleaseId,
}: {
  moduleId: string;
  revisions: Revision[];
  publishedReleaseId: string;
}) {
  const [evidence, setEvidence] = useState<WikiReviewEvidence | null>(null);
  const [editingHead, setEditingHead] = useState<WikiPageHeadSnapshot | null>(null);
  const [items, setItems] = useState<WikiFactJudgmentRecord[]>([]);
  const [cursor, setCursor] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [reload, setReload] = useState(0);
  const keys = useRef(new CommandKeys());
  const reading = useRef(0);
  const posting = useRef(false);

  useEffect(() => {
    if (!evidence) return;
    const controller = new AbortController();
    const generation = ++reading.current;
    Promise.all([
      knowledgeQuality.editingHead(moduleId, evidence.wiki.entity_id, controller.signal),
      knowledgeQuality.judgments(
        moduleId,
        evidence.wiki.entity_id,
        evidence.wiki.revision_id,
        "",
        controller.signal,
      ),
    ])
      .then(([head, page]) => {
        if (controller.signal.aborted || generation !== reading.current) return;
        setEditingHead(head);
        setItems(page.items || []);
        setCursor(page.next_cursor || "");
        setError("");
      })
      .catch((reason) => {
        if (!controller.signal.aborted && generation === reading.current)
          setError(reason instanceof Error ? reason.message : "固定事实判断读取失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted && generation === reading.current) setLoading(false);
      });
    return () => controller.abort();
  }, [moduleId, evidence, reload]);

  const selectEvidence = (next: WikiReviewEvidence) => {
    if (posting.current) return;
    reading.current++;
    setEvidence(next);
    setEditingHead(null);
    setItems([]);
    setCursor("");
    setError("");
    setMessage("");
    setLoading(true);
    setFormVersion((value) => value + 1);
  };
  const editEvidence = () => {
    if (posting.current || !evidence) return;
    reading.current++;
    setEvidence(null);
    setEditingHead(null);
    setItems([]);
    setCursor("");
    setError("");
    setMessage("");
    setLoading(false);
  };

  async function more() {
    if (!evidence || !cursor || loading) return;
    const current = evidence;
    const generation = reading.current;
    setLoading(true);
    try {
      const page = await knowledgeQuality.judgments(
        moduleId,
        current.wiki.entity_id,
        current.wiki.revision_id,
        cursor,
      );
      if (generation !== reading.current) return;
      setItems((previous) => [
        ...previous,
        ...(page.items || []).filter(
          (item) => !previous.some((old) => old.fact_id === item.fact_id),
        ),
      ]);
      setCursor(page.next_cursor || "");
      setError("");
    } catch (reason) {
      if (generation === reading.current)
        setError(reason instanceof Error ? reason.message : "更早的人审判断读取失败。");
    } finally {
      if (generation === reading.current) setLoading(false);
    }
  }

  async function judge(draft: WikiFactReviewDraft) {
    if (posting.current) return;
    posting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { evidence: fixed, assessment, grade, reason } = draft;
      const quoteSHA = await sha256Utf8(fixed.sourceQuote);
      const claimSHA = fixed.wikiClaim ? await sha256Utf8(fixed.wikiClaim) : "";
      const previous = items.find(
        (item) =>
          item.wiki_revision_id === fixed.wiki.revision_id &&
          item.source_revision_id === fixed.source.revision_id &&
          item.locator === fixed.locator &&
          item.source_quote_sha256 === quoteSHA,
      );
      const intent = {
        source_revision_id: fixed.source.revision_id,
        source_content_sha256: fixed.source.content_hash,
        locator: fixed.locator,
        source_quote: fixed.sourceQuote,
        source_quote_sha256: quoteSHA,
        ...(fixed.wikiClaim
          ? { wiki_claim_text: fixed.wikiClaim, wiki_claim_sha256: claimSHA }
          : {}),
        assessment,
        ...(grade ? { grade } : {}),
        rubric_version: "sea.wiki.fact-coverage.v1",
        reason,
        ...(previous ? { base_judge_revision_id: previous.judge_revision_id } : {}),
      };
      const scope = `wiki-quality:${fixed.wiki.revision_id}:${fixed.source.revision_id}:${fixed.locator}:${quoteSHA}`;
      const input: JudgeWikiFactReq = {
        ...intent,
        idempotency_key: keys.current.key(scope, intent),
      };
      const result = await knowledgeQuality.judge(
        moduleId,
        fixed.wiki.entity_id,
        fixed.wiki.revision_id,
        input,
      );
      keys.current.complete(scope, intent);
      setItems((prior) => [result, ...prior.filter((item) => item.fact_id !== result.fact_id)]);
      setMessage(`已记录这一条事实的人工判断 · 评阅修订 ${result.judge_revision_id}。`);
      setFormVersion((value) => value + 1);
      setLoading(true);
      setReload((value) => value + 1);
    } catch (reason) {
      setError(
        `${reason instanceof Error ? reason.message : "事实判断记录失败"}。当前证据与理由已保留；请读取最新判断后重试。`,
      );
    } finally {
      posting.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="wiki-quality-review">
      <div className="sea-panel-head">
        <div>
          <h2>逐条核对 Wiki 事实</h2>
          <p>目标是一个固定 Wiki 修订中的一条原文事实。记录判断不会改正文或发布指针。</p>
        </div>
        <button
          className="sea-button"
          disabled={!evidence || loading || busy}
          onClick={() => {
            setLoading(true);
            setReload((value) => value + 1);
          }}
        >
          刷新判断
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {editingHead && evidence && (
        <div className="wiki-quality-pointers">
          <p>
            当前编辑头 <span className="knowledge-id">{editingHead.revision_id}</span>
            {editingHead.revision_id === evidence.wiki.revision_id
              ? " · 正在核对此修订"
              : " · 所选为历史修订"}
          </p>
          <p>
            已发布 Release <span className="knowledge-id">{publishedReleaseId || "尚未发布"}</span>
          </p>
        </div>
      )}
      <div className="sea-two-col">
        <WikiReviewEvidencePicker
          moduleId={moduleId}
          revisions={revisions}
          busy={busy}
          onEdit={editEvidence}
          onSelect={selectEvidence}
        />
        <WikiFactReviewForm
          key={formVersion}
          evidence={evidence}
          busy={busy || loading}
          onSubmit={(draft) => void judge(draft)}
        />
      </div>
      {evidence && (
        <div className="wiki-quality-history">
          <h3>这个 Wiki 修订的已有事实判断</h3>
          {loading && <p role="status">正在读取当前编辑头与事实判断…</p>}
          {!loading && !items.length && !error && <p>目前没有已记录的事实判断。</p>}
          {items.map((item) => (
            <article key={item.fact_id} className="sea-source-link">
              <div>
                <strong>
                  {item.assessment === "undetermined"
                    ? "无法判定 · 不打数字分"
                    : `${item.assessment} · ${item.grade ?? "?"} 分`}
                </strong>
                <p>{item.reason}</p>
                <small className="knowledge-id">
                  {item.source_revision_id} · {item.locator} · {item.fact_id}
                </small>
                <small>
                  管理员账号标识 {item.actor_id} · 评阅修订 {item.judge_revision}
                </small>
              </div>
            </article>
          ))}
          {cursor && (
            <button className="sea-button" disabled={loading} onClick={() => void more()}>
              加载更多已记录的判断
            </button>
          )}
        </div>
      )}
    </section>
  );
}
