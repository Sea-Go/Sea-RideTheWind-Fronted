"use client";
import { useEffect, useRef, useState } from "react";

import { Notice } from "@/features/sea/components/primitives";

import {
  type FactSetInputFact,
  type FreezeWikiFactSetReq,
  knowledgeFactSets,
  knowledgeRead,
  type Revision,
  type WikiFactSetRecord,
} from "./api";
import {
  type FactSetScopePreview,
  originalFactSpan,
  previewFactID,
  previewFactSetScope,
  sourceParagraphForFact,
} from "./fact-set-source";
import { sha256Utf8 } from "./quality-source";
import { CommandKeys } from "./state";

type FactRow = {
  id: string;
  sourceId: string;
  locator: string;
  quote: string;
  required: boolean;
  conflictGroup: string;
};
const newRow = (sourceId: string): FactRow => ({
  id: crypto.randomUUID(),
  sourceId,
  locator: "paragraph:1",
  quote: "",
  required: true,
  conflictGroup: "",
});

export function WikiFactSetWorkbench({
  moduleId,
  revisions,
  nextRevisionsCursor,
}: {
  moduleId: string;
  revisions: Revision[];
  nextRevisionsCursor?: string;
}) {
  const [targetId, setTargetId] = useState("");
  const [preview, setPreview] = useState<FactSetScopePreview | null>(null);
  const [rows, setRows] = useState<FactRow[]>([]);
  const [candidateIDs, setCandidateIDs] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const [reason, setReason] = useState("");
  const [current, setCurrent] = useState<WikiFactSetRecord | null>(null);
  const [historyId, setHistoryId] = useState("");
  const [history, setHistory] = useState<WikiFactSetRecord | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const posting = useRef(false);
  const keys = useRef(new CommandKeys());
  const wikiChoices = revisions.filter((revision) => revision.kind === "wiki");
  const selected = wikiChoices.find((revision) => revision.revision_id === targetId);
  const pageId = preview?.wiki.entity_id || selected?.entity_id || "";

  useEffect(() => {
    let active = true;
    Promise.all(
      rows.map(async (row) => {
        const source = preview?.sources.find((item) => item.revision_id === row.sourceId);
        return [
          row.id,
          source && row.quote && originalFactSpan(source, row.locator, row.quote)
            ? await previewFactID(row.sourceId, row.locator, row.quote)
            : "",
        ] as const;
      }),
    ).then((pairs) => {
      if (active) setCandidateIDs(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [preview, rows]);

  async function selectWiki(id: string) {
    const version = ++generation.current;
    setTargetId(id);
    setPreview(null);
    setCurrent(null);
    setHistory(null);
    setHistoryId("");
    setRows([]);
    setComplete(false);
    setReason("");
    setReading(false);
    setError("");
    setMessage("");
    if (!id) return;
    const summary = wikiChoices.find((revision) => revision.revision_id === id);
    if (!summary || summary.withdrawn) return;
    setReading(true);
    try {
      const fixed = await previewFactSetScope(moduleId, summary.entity_id, id, {
        revision: (revisionId) => knowledgeRead.revision(moduleId, revisionId),
        compile: (compileId) => knowledgeRead.compile(moduleId, compileId),
        knownRevisions: revisions,
        olderRevisions: {
          nextCursor: nextRevisionsCursor || "",
          page: (cursor) => knowledgeRead.revisions(moduleId, cursor),
        },
      });
      if (version !== generation.current) return;
      setPreview(fixed);
      setRows([newRow(fixed.sources[0].revision_id)]);
      try {
        const head = await knowledgeFactSets.scope(
          moduleId,
          fixed.wiki.entity_id,
          fixed.sourceScopeRevision,
        );
        if (version === generation.current) setCurrent(head);
      } catch (lookupError) {
        if (version === generation.current)
          setMessage(
            `当前来源范围没有可确认的目录头：${lookupError instanceof Error ? lookupError.message : "读取失败"}。冻结时 RTW 会再核对基修订。`,
          );
      }
    } catch (failure) {
      if (version === generation.current)
        setError(failure instanceof Error ? failure.message : "完整原文范围无法核对。");
    } finally {
      if (version === generation.current) setReading(false);
    }
  }

  const updateRow = (id: string, change: Partial<FactRow>) =>
    setRows((prior) => prior.map((row) => (row.id === id ? { ...row, ...change } : row)));
  const factValid = (row: FactRow) => {
    const source = preview?.sources.find((item) => item.revision_id === row.sourceId);
    const paragraph = source && sourceParagraphForFact(source, row.locator);
    return Boolean(
      paragraph &&
      row.quote.trim() &&
      !row.quote.includes("\u0000") &&
      new TextEncoder().encode(row.quote).length <= 4096 &&
      originalFactSpan(source!, row.locator, row.quote),
    );
  };
  const groupCounts = rows.reduce((counts, row) => {
    if (row.conflictGroup) counts.set(row.conflictGroup, (counts.get(row.conflictGroup) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const groupsValid = [...groupCounts].every(
    ([group, count]) => /^[A-Za-z0-9_.-]{1,64}$/.test(group) && count >= 2,
  );
  const rowsValid =
    rows.length >= 1 &&
    rows.length <= 128 &&
    rows.some((row) => row.required) &&
    rows.every(factValid) &&
    new Set(rows.map((row) => `${row.sourceId}\u0000${row.locator}\u0000${row.quote}`)).size ===
      rows.length &&
    groupsValid;
  const ready = Boolean(
    preview &&
    complete &&
    rowsValid &&
    reason.trim() &&
    !reason.includes("\u0000") &&
    new TextEncoder().encode(reason).length <= 2000 &&
    !reading &&
    !busy,
  );

  async function freeze() {
    if (!ready || !preview || posting.current) return;
    posting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const facts: FactSetInputFact[] = await Promise.all(
        rows.map(async (row) => ({
          source_revision_id: row.sourceId,
          locator: row.locator,
          source_quote: row.quote,
          source_quote_sha256: await sha256Utf8(row.quote),
          required: row.required,
          ...(row.conflictGroup ? { conflict_group: row.conflictGroup } : {}),
        })),
      );
      const intent = {
        ...(preview.originCompileId ? { origin_compile_id: preview.originCompileId } : {}),
        source_revisions: preview.sourceRevisions,
        facts,
        facts_complete: true,
        reason,
        ...(current ? { base_fact_set_revision_id: current.fact_set_revision_id } : {}),
      };
      const scope = `wiki-fact-set:${preview.wiki.revision_id}:${preview.sourceScopeRevision}`;
      const input: FreezeWikiFactSetReq = {
        ...intent,
        idempotency_key: keys.current.key(scope, intent),
      };
      const result = await knowledgeFactSets.freeze(
        moduleId,
        preview.wiki.entity_id,
        preview.wiki.revision_id,
        input,
      );
      if (result.source_scope_revision !== preview.sourceScopeRevision)
        throw new Error("RTW 返回的来源范围与已核对范围不一致。请刷新目录。");
      keys.current.complete(scope, intent);
      setCurrent(result);
      setHistory(result);
      setHistoryId(result.fact_set_revision_id);
      setMessage(
        `事实目录修订 ${result.fact_set_revision_id} 已冻结；Wiki 编辑头与发布版本另行操作。`,
      );
    } catch (failure) {
      setError(
        `${failure instanceof Error ? failure.message : "目录冻结失败"}。事实、理由与声明保持原样；409 时请重新读取当前范围再复核。`,
      );
    } finally {
      posting.current = false;
      setBusy(false);
    }
  }

  async function readHistory(id: string) {
    if (!pageId || !id.trim() || busy) return;
    const version = generation.current;
    setError("");
    setReading(true);
    try {
      const record = await knowledgeFactSets.revision(moduleId, pageId, id.trim());
      if (version !== generation.current) return;
      setHistory(record);
      setHistoryId(record.fact_set_revision_id);
    } catch (failure) {
      if (version === generation.current)
        setError(failure instanceof Error ? failure.message : "历史事实目录读取失败。");
    } finally {
      if (version === generation.current) setReading(false);
    }
  }

  async function readCurrent() {
    if (!preview || reading || busy) return;
    const version = generation.current;
    setError("");
    setReading(true);
    try {
      const record = await knowledgeFactSets.scope(
        moduleId,
        preview.wiki.entity_id,
        preview.sourceScopeRevision,
      );
      if (version !== generation.current) return;
      setCurrent(record);
      setHistory(record);
      setHistoryId(record.fact_set_revision_id);
    } catch (failure) {
      if (version === generation.current)
        setError(failure instanceof Error ? failure.message : "当前来源范围读取失败。");
    } finally {
      if (version === generation.current) setReading(false);
    }
  }

  return (
    <section className="wiki-fact-set-workbench">
      <div className="sea-panel-head">
        <div>
          <h2>Wiki 事实目录</h2>
          <p>
            从固定原文范围列出预期事实，再由管理员声明是否完整。声明只冻结目录，不评价质量或发布
            Wiki。
          </p>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <label className="sea-field">
        固定 Wiki 修订
        <select
          value={targetId}
          disabled={busy}
          onChange={(event) => void selectWiki(event.target.value)}
        >
          <option value="">请选择</option>
          {wikiChoices.map((revision) => (
            <option key={revision.revision_id} value={revision.revision_id}>
              {revision.title} · {revision.entity_id} · {revision.revision_id}
              {revision.withdrawn ? "（已撤回，仅可查历史）" : ""}
            </option>
          ))}
        </select>
      </label>
      {reading && <p role="status">正在读取固定目录或来源修订…</p>}
      {selected?.withdrawn && (
        <Notice>所选 Wiki 已撤回，不能创建新目录。仍可按已知目录修订 ID 读取历史。</Notice>
      )}
      {preview && (
        <>
          <p className="knowledge-id">
            Wiki {preview.wiki.revision_id} · 来源范围 {preview.sourceScopeRevision}
            {preview.originCompileId && ` · 已接纳编制 ${preview.originCompileId}`}
          </p>
          <p>
            待 RTW 核准的范围含 {preview.sources.length} 份有效来源；提交时服务端重新核对固定
            Wiki、同页来源链和编制的完整范围。
          </p>
          <div className="wiki-fact-set-sources">
            {preview.sources.map((source) => (
              <p key={source.revision_id} className="knowledge-id">
                原文 {source.revision_id} · SHA-256 {source.content_hash}
              </p>
            ))}
          </div>
          {current && (
            <Notice>
              此来源范围当前目录修订 {current.fact_set_revision_id}；新冻结将以它为基修订进行 CAS。
            </Notice>
          )}
          <div className="wiki-fact-set-rows">
            <h3>预期事实片段</h3>
            {rows.map((row, index) => {
              const source = preview.sources.find((item) => item.revision_id === row.sourceId);
              const paragraph = source && sourceParagraphForFact(source, row.locator);
              const quoteSpan =
                source && row.quote && originalFactSpan(source, row.locator, row.quote);
              return (
                <fieldset key={row.id} className="wiki-fact-set-row">
                  <legend>事实 {index + 1}</legend>
                  <div className="wiki-fact-set-grid">
                    <label className="sea-field">
                      原文修订
                      <select
                        value={row.sourceId}
                        disabled={busy}
                        onChange={(event) =>
                          updateRow(row.id, { sourceId: event.target.value, quote: "" })
                        }
                      >
                        {preview.sources.map((item) => (
                          <option key={item.revision_id} value={item.revision_id}>
                            {item.title} · {item.revision_id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="sea-field">
                      原始段落定位
                      <input
                        value={row.locator}
                        disabled={busy}
                        onChange={(event) =>
                          updateRow(row.id, { locator: event.target.value, quote: "" })
                        }
                        placeholder="paragraph:1"
                      />
                    </label>
                  </div>
                  {paragraph ? (
                    <>
                      <pre className="knowledge-body">{paragraph}</pre>
                      <button
                        className="sea-button"
                        type="button"
                        disabled={busy || new TextEncoder().encode(paragraph).length > 4096}
                        onClick={() => updateRow(row.id, { quote: paragraph })}
                      >
                        使用整段原文
                      </button>
                    </>
                  ) : (
                    <p role="alert">这份原文没有该固定段落。</p>
                  )}
                  <label className="sea-field">
                    原文字节片段
                    <textarea
                      rows={3}
                      value={row.quote}
                      disabled={busy}
                      onChange={(event) => updateRow(row.id, { quote: event.target.value })}
                      aria-invalid={Boolean(row.quote) && !factValid(row)}
                      placeholder="从上方段落逐字复制，保留换行和空格"
                    />
                  </label>
                  {row.quote && !factValid(row) && (
                    <p role="alert">片段须逐字属于此段原文，且不超过 4096 字节。</p>
                  )}
                  {quoteSpan && (
                    <p className="knowledge-id">
                      原始字节范围 {quoteSpan.start}:{quoteSpan.end} · 候选 FactID{" "}
                      {candidateIDs[row.id] || "正在计算…"}
                      <br />
                      冻结后以 RTW 返回的事实 ID 和字节范围为准。
                    </p>
                  )}
                  <div className="wiki-fact-set-grid">
                    <label className="sea-checkbox">
                      <input
                        type="checkbox"
                        checked={row.required}
                        disabled={busy}
                        onChange={(event) => updateRow(row.id, { required: event.target.checked })}
                      />
                      必须覆盖的事实
                    </label>
                    <label className="sea-field">
                      冲突组（选填，组内至少两条）
                      <input
                        value={row.conflictGroup}
                        disabled={busy}
                        onChange={(event) =>
                          updateRow(row.id, { conflictGroup: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="sea-button"
                    disabled={busy || rows.length === 1}
                    onClick={() => setRows((prior) => prior.filter((item) => item.id !== row.id))}
                  >
                    移除此条
                  </button>
                </fieldset>
              );
            })}
            <button
              type="button"
              className="sea-button"
              disabled={busy || rows.length >= 128}
              onClick={() => setRows((prior) => [...prior, newRow(preview.sources[0].revision_id)])}
            >
              添加事实
            </button>
            {!rowsValid && (
              <p>请逐字核对每条原文事实；至少一条必须覆盖，事实不能重复，冲突组至少两条。</p>
            )}
          </div>
          <label className="sea-field">
            声明理由
            <textarea
              rows={3}
              maxLength={2000}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              placeholder="说明为什么这组事实代表此来源范围的预期事实"
            />
          </label>
          <label className="sea-checkbox">
            <input
              type="checkbox"
              checked={complete}
              disabled={busy}
              onChange={(event) => setComplete(event.target.checked)}
            />
            我以管理员身份声明：已列出该固定来源范围内预期的全部事实
          </label>
          <p>“完整”是管理员对该范围的声明，来源校验只能证实片段归属，不能证明没有遗漏。</p>
          <button className="sea-button primary" disabled={!ready} onClick={() => void freeze()}>
            {busy ? "正在冻结…" : "冻结事实目录"}
          </button>
        </>
      )}
      {pageId && (
        <section className="wiki-fact-set-history">
          <h3>固定目录与历史修订</h3>
          <p>
            历史按明确修订 ID
            读取；旧目录原样保留。来源撤回后只查看目录原有事实片段，不重新读取已撤回的来源正文。
          </p>
          {preview && (
            <button
              type="button"
              className="sea-button"
              disabled={reading || busy}
              onClick={() => void readCurrent()}
            >
              读取当前来源范围
            </button>
          )}
          <label className="sea-field">
            事实目录修订 ID
            <input
              value={historyId}
              disabled={reading || busy}
              onChange={(event) => setHistoryId(event.target.value)}
              placeholder="fact_set_revision_…"
            />
          </label>
          <button
            type="button"
            className="sea-button"
            disabled={!historyId.trim() || reading || busy}
            onClick={() => void readHistory(historyId)}
          >
            查看指定修订
          </button>
          {history && (
            <>
              <FactSetRecordView record={history} />
              {history.base_fact_set_revision_id && (
                <button
                  type="button"
                  className="sea-button"
                  disabled={reading || busy}
                  onClick={() => void readHistory(history.base_fact_set_revision_id)}
                >
                  查看上一次目录修订
                </button>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}

function FactSetRecordView({ record }: { record: WikiFactSetRecord }) {
  const fields: [string, string][] = [
    ["目录修订 ID", record.fact_set_revision_id],
    ["目录连续序号", record.fact_set_revision],
    ["上次目录修订", record.base_fact_set_revision_id || "初次声明"],
    ["固定 Wiki 修订", record.wiki_revision_id],
    ["Wiki 正文 SHA-256", record.wiki_content_sha256],
    ["来源范围", record.source_scope_revision],
    ["管理员账号标识", record.actor_id],
    ["声明来源", record.declaration_source],
    ["冻结时间", record.frozen_at],
    ["目录 JCS SHA-256", record.fact_set_jcs_sha256],
    ["事件 ID", record.event_id || "未记录"],
    ["事件原字节 SHA-256", record.event_raw_sha256 || "未记录"],
    ["事件 JCS SHA-256", record.event_jcs_sha256 || "未记录"],
  ];
  return (
    <article className="wiki-fact-set-record">
      <h4>事实目录修订 {record.fact_set_revision}</h4>
      <p>{record.reason}</p>
      <p>
        管理员声明完整：{record.facts_complete ? "是" : "否"} · 必须覆盖事实{" "}
        {record.facts.filter((fact) => fact.required).length} / 共 {record.facts.length}
      </p>
      <details>
        <summary>查看原始范围、每条事实及固定标识</summary>
        <dl className="wiki-fact-history-fields">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <code>{value}</code>
              </dd>
            </div>
          ))}
        </dl>
        <h5>原文修订范围</h5>
        {record.source_revisions.map((source) => (
          <p key={source.revision_id} className="knowledge-id">
            {source.revision_id} · SHA-256 {source.content_sha256}
          </p>
        ))}
        <h5>固定事实片段</h5>
        {record.facts.map((fact) => (
          <div key={fact.fact_id} className="wiki-fact-set-fact">
            <p>
              {fact.required ? "必须覆盖" : "参考事实"} · {fact.locator}
              {fact.conflict_group && ` · 冲突组 ${fact.conflict_group}`}
            </p>
            <blockquote>{fact.source_quote}</blockquote>
            <p className="knowledge-id">
              FactID {fact.fact_id} · 原文 {fact.source_revision_id} · 字节 {fact.source_byte_start}
              :{fact.source_byte_end}
              <br />
              原文 SHA-256 {fact.source_content_sha256} · 片段 SHA-256 {fact.source_quote_sha256}
            </p>
          </div>
        ))}
      </details>
    </article>
  );
}
