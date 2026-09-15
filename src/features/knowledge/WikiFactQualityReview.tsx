"use client";
import { useEffect, useRef, useState } from "react";

import { Notice } from "@/features/sea/components/primitives";

import {
  type JudgeWikiFactReq,
  knowledge,
  knowledgeQuality,
  type ReleaseState,
  type Revision,
  type WikiFactJudgmentRecord,
  type WikiPageHeadSnapshot,
} from "./api";
import { sha256Utf8 } from "./quality-source";
import { CommandKeys } from "./state";
import {
  assessmentNames,
  type WikiFactReviewDraft,
  WikiFactReviewForm,
} from "./WikiFactReviewForm";
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
  const [target, setTarget] = useState<Revision | null>(null);
  const [evidence, setEvidence] = useState<WikiReviewEvidence | null>(null);
  const [editingHead, setEditingHead] = useState<WikiPageHeadSnapshot | null>(null);
  const [currentRelease, setCurrentRelease] = useState<ReleaseState | null>(null);
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
    if (!target) return;
    const controller = new AbortController();
    const generation = ++reading.current;
    Promise.all([
      knowledgeQuality.editingHead(moduleId, target.entity_id, controller.signal),
      knowledgeQuality.judgments(
        moduleId,
        target.entity_id,
        target.revision_id,
        "",
        controller.signal,
      ),
      knowledge.current(moduleId, controller.signal),
    ])
      .then(([head, page, release]) => {
        if (controller.signal.aborted || generation !== reading.current) return;
        setEditingHead(head);
        setCurrentRelease(release);
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
  }, [moduleId, target, reload]);

  const selectTarget = (next: Revision | null) => {
    if (posting.current) return;
    reading.current++;
    setTarget(next);
    setEvidence(null);
    setEditingHead(null);
    setCurrentRelease(null);
    setItems([]);
    setCursor("");
    setError("");
    setMessage("");
    setLoading(Boolean(next));
    setFormVersion((value) => value + 1);
  };
  const selectEvidence = (next: WikiReviewEvidence) => {
    if (posting.current) return;
    if (!target || target.revision_id !== next.wiki.revision_id) selectTarget(next.wiki);
    setEvidence(next);
    setFormVersion((value) => value + 1);
  };
  const editEvidence = () => {
    if (posting.current || !evidence) return;
    setEvidence(null);
    setMessage("");
  };

  async function more() {
    if (!target || !cursor || loading) return;
    const current = target;
    const generation = reading.current;
    setLoading(true);
    try {
      const page = await knowledgeQuality.judgments(
        moduleId,
        current.entity_id,
        current.revision_id,
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
          disabled={!target || loading || busy}
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
      {target?.withdrawn && (
        <Notice>所选 Wiki 修订已撤回。此前记录的事实判断仍可查阅，原正文不再供重新取证。</Notice>
      )}
      {editingHead && target && (
        <div className="wiki-quality-pointers">
          <p>
            当前编辑头 <span className="knowledge-id">{editingHead.revision_id}</span>
            {editingHead.revision_id === target.revision_id
              ? " · 正在核对此修订"
              : " · 所选为历史修订"}
          </p>
          <p>
            已发布 Release{" "}
            <span className="knowledge-id">
              {currentRelease
                ? currentRelease.active_release_id || "尚未发布"
                : publishedReleaseId || "尚未发布"}
            </span>
          </p>
        </div>
      )}
      <div className="sea-two-col">
        <WikiReviewEvidencePicker
          moduleId={moduleId}
          revisions={revisions}
          busy={busy}
          onEdit={editEvidence}
          onTarget={selectTarget}
          onSelect={selectEvidence}
        />
        <WikiFactReviewForm
          key={formVersion}
          evidence={evidence}
          busy={busy || loading}
          onSubmit={(draft) => void judge(draft)}
        />
      </div>
      {target && (
        <div className="wiki-quality-history">
          <h3>这个 Wiki 修订的已有事实判断</h3>
          {loading && <p role="status">正在读取当前编辑头与事实判断…</p>}
          {!loading && !items.length && !error && <p>目前没有已记录的事实判断。</p>}
          {items.map((item) => (
            <WikiFactHistoryEntry key={item.fact_id} item={item} />
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

function WikiFactHistoryEntry({ item }: { item: WikiFactJudgmentRecord }) {
  const titleId = `wiki-fact-history-${item.judge_revision_id}`;
  const detailRows: [string, string][] = [
    ["原文修订 ID", item.source_revision_id],
    ["原文正文 SHA-256", item.source_content_sha256],
    ["原文事实片段 SHA-256", item.source_quote_sha256],
    ["原文引文字节范围", `${item.source_byte_start}:${item.source_byte_end}`],
    ["Wiki 修订 ID", item.wiki_revision_id],
    ["Wiki 正文 SHA-256", item.wiki_content_sha256],
    ["Wiki 断言 SHA-256", item.wiki_claim_sha256 || "未记录"],
    ["精确来源引用", item.citation_present ? "有" : "无"],
    ["事实 ID", item.fact_id],
    ["判断 ID", item.judgment_id],
    ["评阅修订 ID", item.judge_revision_id],
    ["上次评阅修订 ID", item.base_judge_revision_id || "初次判断"],
    ["管理员账号标识", item.actor_id],
    ["评阅时间", item.judged_at],
    ["等级合同", item.rubric_version],
    ["技术判断类别", item.assessment],
    ["技术等级", item.grade || "无法判定，不打数字分"],
    ["模块 ID", item.module_id],
    ["Wiki 页面 ID", item.page_id],
    ["Wiki 上次正文修订 ID", item.base_wiki_revision_id || "初版"],
    ["Wiki 来源", item.wiki_origin_kind],
    ["来源编制 ID", item.origin_compile_id || "无"],
    ["评阅时原文已撤回", item.source_withdrawn ? "是" : "否"],
    ["评阅时 Wiki 已撤回", item.wiki_withdrawn ? "是" : "否"],
    ["记录合同版本", item.schema_version],
    ["事件 ID", item.event_id || "未记录"],
    ["事件原字节 SHA-256", item.event_raw_sha256 || "未记录"],
    ["事件 JCS SHA-256", item.event_jcs_sha256 || "未记录"],
  ];

  return (
    <article className="wiki-fact-history-entry" aria-labelledby={titleId}>
      <header className="wiki-fact-history-head">
        <h4 id={titleId}>
          {item.assessment === "undetermined"
            ? "无法判定 · 不打数字分"
            : `${assessmentNames[item.assessment] || item.assessment} · ${item.grade ?? "?"} 分`}
        </h4>
        <span>评阅修订 {item.judge_revision}</span>
      </header>
      <p className="wiki-fact-history-reason">{item.reason}</p>
      <p className="wiki-fact-history-source">来源段落 {item.locator}</p>
      <details className="wiki-fact-history-evidence">
        <summary>查看固定证据与完整标识</summary>
        <div className="wiki-fact-history-evidence-body">
          <h5>原文事实片段</h5>
          <blockquote>{item.source_quote}</blockquote>
          <h5>Wiki 中的对应断言</h5>
          <blockquote>{item.wiki_claim_text || "未记录断言"}</blockquote>
          <dl className="wiki-fact-history-fields">
            {detailRows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <code>{value}</code>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </article>
  );
}
