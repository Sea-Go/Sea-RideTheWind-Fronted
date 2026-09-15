"use client";
import { useEffect, useRef, useState } from "react";

import { EmptyState, Notice, SeaLink } from "@/features/sea/components/primitives";

import {
  type Build,
  type Compile,
  knowledge,
  knowledgeRead,
  type Module,
  type Release,
  type ReleaseState,
  type Revision,
} from "./api";
import { RevisionCompare } from "./RevisionCompare";
import { CommandKeys, isPending, parseProfiles, statusName } from "./state";
import { WikiFactQualityReview } from "./WikiFactQualityReview";
import { WikiFactSetWorkbench } from "./WikiFactSetWorkbench";

import "./knowledge.css";

type HistoryKind = "revisions" | "releases" | "builds" | "compiles";
type Snapshot = {
  module: Module;
  next: Partial<Record<HistoryKind, string>>;
  state: ReleaseState;
  revisions: Revision[];
  releases: Release[];
  builds: Build[];
  compiles: Compile[];
};
export function KnowledgeWorkbench({ moduleId }: { moduleId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("资料与修订");
  const [tick, setTick] = useState(0);
  const keys = useRef(new CommandKeys());
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceOrigin, setSourceOrigin] = useState("");
  const [sourceBase, setSourceBase] = useState<Revision | null>(null);
  const [pageId, setPageId] = useState("");
  const [wikiTitle, setWikiTitle] = useState("");
  const [wikiText, setWikiText] = useState("");
  const [wikiBase, setWikiBase] = useState<Revision | null>(null);
  const [sourceRef, setSourceRef] = useState("");
  const [locator, setLocator] = useState("paragraph:1");
  const [references, setReferences] = useState<{ revision_id: string; locator: string }[]>([]);
  const [guidance, setGuidance] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedWiki, setSelectedWiki] = useState<string[]>([]);
  const [chunking, setChunking] = useState("");
  const [profiles, setProfiles] = useState("");
  const [reason, setReason] = useState("");
  const [readBusy, setReadBusy] = useState(false);
  const [pollError, setPollError] = useState("");
  const readController = useRef<AbortController | null>(null);
  const refreshGeneration = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      readController.current?.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const generation = ++refreshGeneration.current;
    Promise.all([
      knowledge.current(moduleId, controller.signal),
      knowledgeRead.module(moduleId, controller.signal),
      knowledgeRead.revisions(moduleId, "", controller.signal),
      knowledgeRead.releases(moduleId, "", controller.signal),
      knowledgeRead.builds(moduleId, "", controller.signal),
      knowledgeRead.compiles(moduleId, "", controller.signal),
    ])
      .then(([state, module, revisions, releases, builds, compiles]) => {
        if (controller.signal.aborted || generation !== refreshGeneration.current) return;
        setSnapshot({
          state,
          module,
          revisions: revisions.items,
          releases: releases.items,
          builds: builds.items,
          compiles: compiles.items,
          next: {
            revisions: revisions.next_cursor,
            releases: releases.next_cursor,
            builds: builds.next_cursor,
            compiles: compiles.next_cursor,
          },
        });
        setError("");
        setPollError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [moduleId, tick]);
  const pendingBuilds =
    tab === "候选与发布"
      ? (snapshot?.builds || [])
          .filter((b) => isPending(b.state))
          .map((b) => b.build_id)
          .join(",")
      : "";
  const pendingCompiles =
    tab === "编制任务"
      ? (snapshot?.compiles || [])
          .filter((c) => isPending(c.state))
          .map((c) => c.compile_id)
          .join(",")
      : "";
  useEffect(() => {
    if ((!pendingBuilds && !pendingCompiles) || busy) return;
    const controller = new AbortController();
    let polling = false;
    const poll = async () => {
      if (document.visibilityState === "hidden" || polling) return;
      polling = true;
      const generation = refreshGeneration.current;
      try {
        const [state, builds, compiles] = await Promise.all([
          knowledge.current(moduleId, controller.signal),
          Promise.all(
            pendingBuilds
              .split(",")
              .filter(Boolean)
              .map((id) => knowledgeRead.build(moduleId, id, controller.signal)),
          ),
          Promise.all(
            pendingCompiles
              .split(",")
              .filter(Boolean)
              .map((id) => knowledgeRead.compile(moduleId, id, controller.signal)),
          ),
        ]);
        if (controller.signal.aborted || generation !== refreshGeneration.current) return;
        setPollError("");
        const terminal = [...builds, ...compiles].some((item) => !isPending(item.state));
        if (terminal) {
          setTick((value) => value + 1);
          return;
        }
        setSnapshot(
          (previous) =>
            previous && {
              ...previous,
              state,
              builds: previous.builds.map(
                (b) => builds.find((next) => next.build_id === b.build_id) || b,
              ),
              compiles: previous.compiles.map(
                (c) => compiles.find((next) => next.compile_id === c.compile_id) || c,
              ),
            },
        );
      } catch (e) {
        if (!controller.signal.aborted)
          setPollError(e instanceof Error ? e.message : "任务状态刷新失败");
      } finally {
        polling = false;
      }
    };
    const interval = window.setInterval(() => void poll(), 5000);
    const visible = () => {
      if (document.visibilityState !== "hidden") void poll();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [moduleId, pendingBuilds, pendingCompiles, busy]);
  const refresh = () => {
    setLoading(true);
    setTick((value) => value + 1);
  };
  async function more(kind: HistoryKind) {
    const cursor = snapshot?.next[kind];
    if (!cursor || loading) return;
    const generation = refreshGeneration.current;
    setLoading(true);
    try {
      const page = await knowledgeRead[kind](moduleId, cursor);
      if (!mounted.current || generation !== refreshGeneration.current) return;
      setSnapshot(
        (previous) =>
          previous && {
            ...previous,
            [kind]: [...previous[kind], ...page.items],
            next: { ...previous.next, [kind]: page.next_cursor },
          },
      );
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "历史加载失败");
    } finally {
      if (mounted.current && generation === refreshGeneration.current) setLoading(false);
    }
  }
  async function editRevision(revision: Revision) {
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    setReadBusy(true);
    setError("");
    try {
      const r = await knowledgeRead.revision(moduleId, revision.revision_id, controller.signal);
      if (controller.signal.aborted) return;
      if (typeof r.content !== "string" || !r.content.trim())
        throw new Error("服务未返回完整正文，保留当前编辑输入。");
      if (r.kind === "source") {
        setSourceBase(r);
        setSourceTitle(r.title);
        setSourceText(r.content);
        setSourceOrigin(r.provenance);
      } else {
        setWikiBase(r);
        setPageId(r.entity_id);
        setWikiTitle(r.title);
        setWikiText(r.content);
        setReferences(r.source_refs || []);
      }
      setTab("资料与修订");
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "读取正文失败");
    } finally {
      if (!controller.signal.aborted) setReadBusy(false);
    }
  }
  async function command<T>(
    scope: string,
    input: object,
    perform: (key: string) => Promise<T>,
    success: (result: T) => void,
  ) {
    if (inFlight.current || readBusy) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await perform(keys.current.key(scope, input));
      keys.current.complete(scope, input);
      if (!mounted.current) return;
      success(result);
      refresh();
    } catch (e) {
      if (mounted.current)
        setError(
          `${e instanceof Error ? e.message : "请求失败"}。输入保留；请核对最新状态后重试。`,
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const allSources = (snapshot?.revisions || []).filter((r) => r.kind === "source" && !r.withdrawn);
  const toggle = (value: string, values: string[], setter: (v: string[]) => void) =>
    setter(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  function addReference() {
    if (!sourceRef || !/^paragraph:[1-9]\d*$/.test(locator)) {
      setError("请选定原文修订，并填写 paragraph:1 这样的段落定位。");
      return;
    }
    if (!references.some((r) => r.revision_id === sourceRef && r.locator === locator))
      setReferences([...references, { revision_id: sourceRef, locator }]);
  }
  function saveSource(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      title: sourceTitle.trim(),
      content: sourceText,
      media_type: "text/markdown",
      provenance: sourceOrigin.trim(),
      ...(sourceBase
        ? { source_id: sourceBase.entity_id, base_revision_id: sourceBase.revision_id }
        : {}),
    };
    void command(
      "source",
      input,
      (key) => knowledge.source(moduleId, { ...input, idempotency_key: key }),
      (result) => {
        setMessage(`原文已保存为新修订 ${result.revision_id}，尚未发布。`);
        setSourceBase(result);
        setSelectedSources((v) => [
          ...v.filter((id) => id !== sourceBase?.revision_id),
          result.revision_id,
        ]);
      },
    );
  }
  function saveWiki(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      title: wikiTitle.trim(),
      content: wikiText,
      source_refs: references,
      ...(wikiBase ? { base_revision_id: wikiBase.revision_id } : {}),
    };
    void command(
      `wiki:${pageId.trim()}`,
      input,
      (key) => knowledge.wiki(moduleId, pageId.trim(), { ...input, idempotency_key: key }),
      (result) => {
        setMessage(`Wiki 已形成新修订 ${result.revision_id}，原文与历史版本保持不变。`);
        setWikiBase(result);
        setSelectedWiki((v) => [
          ...v.filter((id) => id !== wikiBase?.revision_id),
          result.revision_id,
        ]);
      },
    );
  }
  function createCompile() {
    const input = {
      page_id: pageId.trim(),
      source_revision_ids: selectedSources,
      guidance: guidance.trim(),
      ...(wikiBase ? { base_revision_id: wikiBase.revision_id } : {}),
    };
    void command(
      "compile",
      input,
      (key) => knowledge.compile(moduleId, { ...input, idempotency_key: key }),
      (result) => {
        setSnapshot(
          (previous) =>
            previous && {
              ...previous,
              compiles: [
                result,
                ...previous.compiles.filter((c) => c.compile_id !== result.compile_id),
              ],
            },
        );
        setMessage(`编制请求已受理：${statusName(result.state)}。完成与否以服务回执为准。`);
      },
    );
  }
  function freezeRelease(event: React.FormEvent) {
    event.preventDefault();
    try {
      const input = {
        source_revision_ids: selectedSources,
        wiki_revision_ids: selectedWiki,
        chunking_profile: chunking.trim(),
        retrieval_profiles: parseProfiles(profiles),
      };
      void command(
        "release",
        input,
        (key) => knowledge.release(moduleId, { ...input, idempotency_key: key }),
        (result) => {
          setSnapshot(
            (previous) =>
              previous && {
                ...previous,
                releases: [
                  result,
                  ...previous.releases.filter((r) => r.release_id !== result.release_id),
                ],
              },
          );
          setMessage(`候选 v${result.ordinal} 已冻结，还需构建与手动发布。`);
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "请核对索引配置。");
    }
  }
  function createBuild(releaseId: string) {
    void command(
      `build:${releaseId}`,
      {},
      (key) => knowledge.build(releaseId, { idempotency_key: key }),
      (result) => {
        setSnapshot(
          (previous) =>
            previous && {
              ...previous,
              builds: [result, ...previous.builds.filter((b) => b.build_id !== result.build_id)],
            },
        );
        setMessage(
          `构建请求已受理：${statusName(result.state)}。三路模型与索引完成前不会显示就绪。`,
        );
      },
    );
  }
  function cancel(kind: "build" | "compile", id: string) {
    const input = { reason: reason.trim() };
    if (!input.reason) {
      setError("请先填写操作说明，再取消任务。");
      return;
    }
    if (kind === "build")
      void command(
        `cancel-build:${id}`,
        input,
        (key) => knowledge.cancelBuild(id, { ...input, idempotency_key: key }),
        (result) => {
          setSnapshot(
            (previous) =>
              previous && {
                ...previous,
                builds: previous.builds.map((b) => (b.build_id === id ? result : b)),
              },
          );
          setMessage(`构建状态：${statusName(result.state)}。`);
        },
      );
    else
      void command(
        `cancel-compile:${id}`,
        input,
        (key) => knowledge.cancelCompile(id, { ...input, idempotency_key: key }),
        (result) => {
          setSnapshot(
            (previous) =>
              previous && {
                ...previous,
                compiles: previous.compiles.map((c) => (c.compile_id === id ? result : c)),
              },
          );
          setMessage(`编制状态：${statusName(result.state)}。`);
        },
      );
  }
  function activate(releaseId: string, buildId: string) {
    if (!snapshot) return;
    const input = {
      release_id: releaseId,
      build_id: buildId,
      expected_pointer_revision: snapshot.state.pointer_revision,
      reason: reason.trim(),
    };
    void command(
      "activate",
      input,
      (key) => knowledge.activate(moduleId, { ...input, idempotency_key: key }),
      (result) => {
        setSnapshot((previous) => previous && { ...previous, state: result });
        setMessage(`手动切换成功，当前版本 ${result.active_release_id}。历史阅读仍使用原修订。`);
      },
    );
  }
  const state = snapshot?.state;

  return (
    <div className="sea-content sea-knowledge-workbench">
      <div className="sea-breadcrumb">
        <SeaLink href="/workbench/modules">管理模块</SeaLink>
        <span>/</span>
        <span className="knowledge-id">{snapshot?.module.title || moduleId}</span>
      </div>
      <div className="sea-page-heading compact">
        <div>
          <span className="sea-eyebrow">KNOWLEDGE STUDIO</span>
          <h1>让每一次修订，有据可循。</h1>
          <p>资料、Wiki、编制、候选与发布分别管理。当前表单中的内容只有提交成功才会形成新修订。</p>
        </div>
        <button className="sea-button" onClick={refresh} disabled={loading || busy}>
          刷新状态
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {pollError && <Notice error>自动刷新暂不可用，当前显示上次读取的状态：{pollError}</Notice>}
      {message && <Notice>{message}</Notice>}
      {loading && <p role="status">正在读取知识工作台…</p>}
      {readBusy && <p role="status">正在读取修订正文，当前输入保持不变…</p>}
      {!snapshot ? (
        <EmptyState title={loading ? "读取中" : "工作台暂不可用"}>
          需要具有知识维护权限的登录身份和可连接的产品服务。<SeaLink href="/login">登录</SeaLink>
        </EmptyState>
      ) : (
        <>
          <div className="sea-workbench-summary">
            <div>
              <span>当前生效</span>
              <strong className="knowledge-id">{state?.active_release_id || "尚未发布"}</strong>
              <small>指针版本 {state?.pointer_revision}</small>
            </div>
            <div>
              <span>最新候选</span>
              <strong className="knowledge-id">{state?.candidate_release_id || "尚未冻结"}</strong>
            </div>
            <div>
              <span>正式版原文与 Wiki</span>
              <strong>
                {snapshot.module.sources} / {snapshot.module.pages}
              </strong>
              <small>各自保留独立历史</small>
            </div>
            <div>
              <span>候选构建</span>
              <strong>{statusName(state?.build_state || "UNKNOWN")}</strong>
              <small>就绪后仍需人工发布</small>
            </div>
          </div>
          <div className="sea-toolbar">
            <div className="sea-tabs">
              {["资料与修订", "编制任务", "修订比较", "事实目录", "事实核验", "候选与发布"].map(
                (t) => (
                  <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                    {t}
                  </button>
                ),
              )}
            </div>
            {state?.active_release_id && (
              <SeaLink href={`/knowledge/${encodeURIComponent(moduleId)}`}>阅读正式版 →</SeaLink>
            )}
          </div>
          {tab === "资料与修订" && (
            <div className="sea-two-col">
              <section>
                {snapshot.next.revisions && (
                  <button
                    className="sea-button"
                    disabled={loading}
                    onClick={() => void more("revisions")}
                  >
                    加载更早修订
                  </button>
                )}
                <form onSubmit={saveSource}>
                  <fieldset disabled={readBusy} className="knowledge-editor-fields">
                    <h2>原始资料</h2>
                    <p>支持 UTF-8 Markdown 或纯文本。每次保存创建独立修订，保留出处。</p>
                    <label className="sea-field">
                      资料标题
                      <input
                        required
                        value={sourceTitle}
                        onChange={(e) => setSourceTitle(e.target.value)}
                      />
                    </label>
                    <label className="sea-field">
                      出处说明
                      <input
                        required
                        value={sourceOrigin}
                        onChange={(e) => setSourceOrigin(e.target.value)}
                        placeholder="书名、作者、页码或原始链接"
                      />
                    </label>
                    <label className="sea-field">
                      导入文本文件
                      <input
                        type="file"
                        accept=".md,.markdown,.txt,text/plain,text/markdown"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 4 * 1024 * 1024) {
                            setError("文本文件超过 4 MiB，请拆分资料后导入。");
                            return;
                          }
                          try {
                            const text = new TextDecoder("utf-8", { fatal: true }).decode(
                              await file.arrayBuffer(),
                            );
                            setSourceText(text);
                            if (!sourceTitle) setSourceTitle(file.name.replace(/\.[^.]+$/, ""));
                          } catch {
                            setError("文件必须为有效 UTF-8 文本，当前不支持 PDF/OCR。");
                          }
                        }}
                      />
                    </label>
                    <label className="sea-field">
                      原文正文
                      <textarea
                        required
                        rows={10}
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                      />
                    </label>
                    {sourceBase && (
                      <p className="knowledge-id">基于修订 {sourceBase.revision_id}</p>
                    )}
                    <div className="sea-actions">
                      <button
                        className="sea-button primary"
                        disabled={busy || !sourceText.trim() || !sourceOrigin.trim()}
                      >
                        {sourceBase ? "保存原文新修订" : "保存原始资料"}
                      </button>
                      {sourceBase && (
                        <button
                          type="button"
                          className="sea-button"
                          onClick={() => {
                            setSourceBase(null);
                            setSourceTitle("");
                            setSourceText("");
                            setSourceOrigin("");
                          }}
                        >
                          新建另一份资料
                        </button>
                      )}
                    </div>
                  </fieldset>
                </form>
                <h3>原文历史</h3>
                {snapshot.revisions
                  .filter((r) => r.kind === "source")
                  .map((r) => (
                    <div key={r.revision_id} className="sea-source-link">
                      <div>
                        <strong>
                          {r.title}
                          {r.withdrawn ? " · 已撤回" : ""}
                        </strong>
                        <p className="knowledge-id">{r.revision_id}</p>
                      </div>
                      <button
                        className="sea-button"
                        disabled={busy || readBusy || r.withdrawn}
                        onClick={() => void editRevision(r)}
                      >
                        基于此修订编辑
                      </button>
                    </div>
                  ))}
              </section>
              <section>
                <form onSubmit={saveWiki}>
                  <fieldset disabled={readBusy} className="knowledge-editor-fields">
                    <h2>Wiki 知识页</h2>
                    <label className="sea-field">
                      页面标识
                      <input
                        required
                        value={pageId}
                        disabled={Boolean(wikiBase)}
                        onChange={(e) => setPageId(e.target.value)}
                        placeholder="如 climate-and-mountains"
                      />
                    </label>
                    <label className="sea-field">
                      知识页标题
                      <input
                        required
                        value={wikiTitle}
                        onChange={(e) => setWikiTitle(e.target.value)}
                      />
                    </label>
                    <label className="sea-field">
                      知识页正文
                      <textarea
                        required
                        rows={10}
                        value={wikiText}
                        onChange={(e) => setWikiText(e.target.value)}
                      />
                    </label>
                    <fieldset>
                      <legend>绑定来源修订与段落</legend>
                      <label className="sea-field">
                        原文修订
                        <select value={sourceRef} onChange={(e) => setSourceRef(e.target.value)}>
                          <option value="">请选择</option>
                          {allSources.map((r) => (
                            <option key={r.revision_id} value={r.revision_id}>
                              {r.title} · {r.revision_id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="sea-field">
                        段落定位
                        <input value={locator} onChange={(e) => setLocator(e.target.value)} />
                      </label>
                      <button type="button" className="sea-button" onClick={addReference}>
                        加入来源引用
                      </button>
                      {references.map((ref, i) => (
                        <p key={`${ref.revision_id}:${ref.locator}`} className="knowledge-id">
                          {ref.revision_id} · {ref.locator}{" "}
                          <button
                            type="button"
                            onClick={() => setReferences(references.filter((_, n) => n !== i))}
                          >
                            移除
                          </button>
                        </p>
                      ))}
                    </fieldset>
                    {wikiBase && (
                      <p className="knowledge-id">
                        基于修订 {wikiBase.revision_id}，并发修改会返回冲突。
                      </p>
                    )}
                    <div className="sea-actions">
                      <button
                        className="sea-button primary"
                        disabled={busy || !wikiText.trim() || !references.length}
                      >
                        保存 Wiki 新修订
                      </button>
                      {wikiBase && (
                        <button
                          type="button"
                          className="sea-button"
                          onClick={() => {
                            setWikiBase(null);
                            setPageId("");
                            setWikiTitle("");
                            setWikiText("");
                            setReferences([]);
                          }}
                        >
                          新建另一知识页
                        </button>
                      )}
                    </div>
                  </fieldset>
                </form>
                <h3>Wiki 历史</h3>
                {snapshot.revisions
                  .filter((r) => r.kind === "wiki")
                  .map((r) => (
                    <div className="sea-source-link" key={r.revision_id}>
                      <div>
                        <strong>
                          {r.title}
                          {r.withdrawn ? " · 已撤回" : ""}
                        </strong>
                        <p className="knowledge-id">{r.revision_id}</p>
                      </div>
                      <button
                        className="sea-button"
                        disabled={busy || readBusy || r.withdrawn}
                        onClick={() => void editRevision(r)}
                      >
                        基于此修订编辑
                      </button>
                    </div>
                  ))}
              </section>
            </div>
          )}
          {tab === "编制任务" && (
            <section>
              <h2>让 AI 编制候选，人工决定发布</h2>
              <p>
                选择不可变原文修订，填写目标页面和编制要求。后台没有可用 worker
                时，受理状态会保持等待执行。
              </p>
              <RevisionPicker
                title="编制依据"
                items={allSources}
                selected={selectedSources}
                toggle={(id) => toggle(id, selectedSources, setSelectedSources)}
              />
              <label className="sea-field">
                目标页面标识
                <input
                  value={pageId}
                  disabled={Boolean(wikiBase)}
                  onChange={(e) => setPageId(e.target.value)}
                />
              </label>
              {wikiBase && <p>以当前编辑的 Wiki 修订为基础，编制不会覆盖后续人工修改。</p>}
              <label className="sea-field">
                编制要求
                <textarea rows={4} value={guidance} onChange={(e) => setGuidance(e.target.value)} />
              </label>
              <button
                className="sea-button primary"
                disabled={busy || !pageId.trim() || !selectedSources.length || !guidance.trim()}
                onClick={createCompile}
              >
                提交编制任务
              </button>
              <label className="sea-field">
                操作说明
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              {snapshot.compiles.map((c) => (
                <div className="sea-note-card" key={c.compile_id}>
                  <h3>{c.state === "BUILDING" ? "正在编制" : statusName(c.state)}</h3>
                  <p className="knowledge-id">
                    任务 {c.compile_id} · 页面 {c.page_id}
                  </p>
                  {c.revision_id && <p className="knowledge-id">候选修订 {c.revision_id}</p>}
                  {c.state === "BUILDING" && (
                    <p>
                      {c.attempt_id
                        ? `执行尝试：${c.attempt_id}`
                        : "已受理，等待编制 worker 领取。"}
                    </p>
                  )}
                  {c.error_code && <Notice error>{c.error_code}</Notice>}
                  {isPending(c.state) && (
                    <button
                      className="sea-button"
                      disabled={busy || !reason.trim()}
                      onClick={() => cancel("compile", c.compile_id)}
                    >
                      取消编制
                    </button>
                  )}
                </div>
              ))}
              {snapshot.next.compiles && (
                <button
                  className="sea-button"
                  disabled={loading}
                  onClick={() => void more("compiles")}
                >
                  加载更早编制
                </button>
              )}
              {!snapshot.compiles.length && <p>尚无可显示的编制任务。</p>}
            </section>
          )}
          {tab === "修订比较" && (
            <>
              <RevisionCompare moduleId={moduleId} revisions={snapshot.revisions} />
              {snapshot.next.revisions && (
                <button
                  className="sea-button"
                  disabled={loading}
                  onClick={() => void more("revisions")}
                >
                  加载更早修订
                </button>
              )}
            </>
          )}
          {tab === "事实核验" && (
            <>
              {snapshot.next.revisions && (
                <button
                  className="sea-button"
                  disabled={loading}
                  onClick={() => void more("revisions")}
                >
                  加载更早修订
                </button>
              )}
              <WikiFactQualityReview
                moduleId={moduleId}
                revisions={snapshot.revisions}
                publishedReleaseId={state?.active_release_id || ""}
              />
            </>
          )}
          {tab === "事实目录" && (
            <>
              {snapshot.next.revisions && (
                <button
                  className="sea-button"
                  disabled={loading}
                  onClick={() => void more("revisions")}
                >
                  加载更早修订
                </button>
              )}
              <WikiFactSetWorkbench moduleId={moduleId} revisions={snapshot.revisions} />
            </>
          )}
          {tab === "候选与发布" && (
            <section>
              <h2>冻结候选版本</h2>
              <p>
                候选和构建历史由服务端读取。选择具体就绪构建可发布或回滚，正式版本以活动指针为准。
              </p>
              <form onSubmit={freezeRelease}>
                <div className="sea-two-col">
                  <RevisionPicker
                    title="纳入候选的原文修订"
                    items={allSources}
                    selected={selectedSources}
                    toggle={(id) => toggle(id, selectedSources, setSelectedSources)}
                  />
                  <RevisionPicker
                    title="纳入候选的 Wiki 修订"
                    items={snapshot.revisions.filter((r) => r.kind === "wiki" && !r.withdrawn)}
                    selected={selectedWiki}
                    toggle={(id) => toggle(id, selectedWiki, setSelectedWiki)}
                  />
                </div>
                <details>
                  <summary>索引配置 · 由搜索负责人提供</summary>
                  <p>
                    配置绑定本次冻结版本。请使用已约定的分块与三路检索配置，不能用示例配置证明模型可用。
                  </p>
                  <label className="sea-field">
                    分块配置版本
                    <input
                      required
                      value={chunking}
                      onChange={(e) => setChunking(e.target.value)}
                    />
                  </label>
                  <label className="sea-field">
                    三路检索配置 JSON
                    <textarea
                      required
                      rows={8}
                      value={profiles}
                      onChange={(e) => setProfiles(e.target.value)}
                      placeholder="填写 dense、sparse、multivector 的 encoder、tokenizer、space、dimensions 等已约定配置"
                    />
                  </label>
                </details>
                <button
                  className="sea-button primary"
                  disabled={
                    busy ||
                    !selectedSources.length ||
                    !selectedWiki.length ||
                    !chunking.trim() ||
                    !profiles.trim()
                  }
                >
                  冻结候选版本
                </button>
              </form>
              <label className="sea-field">
                发布、回滚或取消说明
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              {snapshot.releases.map((r) => (
                <div className="sea-note-card" key={r.release_id}>
                  <h3>
                    v{r.ordinal}
                    {r.release_id === state?.active_release_id ? " · 当前生效" : ""}
                  </h3>
                  <p className="knowledge-id">
                    {r.release_id} · {r.manifest_hash}
                  </p>
                  <p>
                    {r.source_revision_ids.length} 份原文修订 · {r.wiki_revision_ids.length} 份 Wiki
                    修订 · {r.chunking_profile}
                  </p>
                  <details>
                    <summary>查看固定修订与配置</summary>
                    <pre className="knowledge-body">
                      {JSON.stringify(
                        {
                          sources: r.source_revision_ids,
                          wiki: r.wiki_revision_ids,
                          retrieval_profiles: r.retrieval_profiles,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                  <button
                    className="sea-button"
                    disabled={busy}
                    onClick={() => createBuild(r.release_id)}
                  >
                    为此候选发起构建
                  </button>
                </div>
              ))}
              {state?.candidate_release_id &&
                !snapshot.releases.some((r) => r.release_id === state.candidate_release_id) && (
                  <div className="sea-note-card">
                    <h3>最新候选</h3>
                    <p className="knowledge-id">{state.candidate_release_id}</p>
                    <button
                      className="sea-button"
                      disabled={busy}
                      onClick={() => createBuild(state.candidate_release_id)}
                    >
                      发起构建
                    </button>
                  </div>
                )}
              {state?.build_state === "READY" &&
                state.build_id &&
                !snapshot.builds.some((b) => b.build_id === state.build_id) && (
                  <div className="sea-note-card">
                    <h3>最新候选已就绪</h3>
                    <p className="knowledge-id">
                      {state.candidate_release_id} · {state.build_id}
                    </p>
                    <button
                      className="sea-button primary"
                      disabled={
                        busy ||
                        !reason.trim() ||
                        (state.active_release_id === state.candidate_release_id &&
                          state.active_build_id === state.build_id)
                      }
                      onClick={() => activate(state.candidate_release_id, state.build_id)}
                    >
                      手动发布此版本
                    </button>
                  </div>
                )}
              {snapshot.builds.map((b) => (
                <div className="sea-note-card" key={b.build_id}>
                  <h3>{statusName(b.state)}</h3>
                  <p className="knowledge-id">
                    {b.release_id} · 构建 {b.build_id} · 第 {b.generation} 代
                  </p>
                  {b.state === "BUILDING" && (
                    <p>
                      {b.attempt_id
                        ? `执行尝试：${b.attempt_id}`
                        : "已受理，等待构建 worker 领取。"}
                    </p>
                  )}
                  {b.error_code && <Notice error>{b.error_code}</Notice>}
                  <div className="sea-actions">
                    {isPending(b.state) && (
                      <button
                        className="sea-button"
                        disabled={busy || !reason.trim()}
                        onClick={() => cancel("build", b.build_id)}
                      >
                        取消构建
                      </button>
                    )}
                    {b.state === "READY" && (
                      <button
                        className="sea-button primary"
                        disabled={
                          busy ||
                          !reason.trim() ||
                          (b.release_id === state?.active_release_id &&
                            b.build_id === state.active_build_id)
                        }
                        onClick={() => activate(b.release_id, b.build_id)}
                      >
                        {(snapshot.releases.find((r) => r.release_id === b.release_id)?.ordinal ??
                          Infinity) <
                        (snapshot.releases.find((r) => r.release_id === state?.active_release_id)
                          ?.ordinal ?? 0)
                          ? "回滚到此就绪版本"
                          : "手动发布此版本"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="sea-actions">
                {snapshot.next.releases && (
                  <button
                    className="sea-button"
                    disabled={loading}
                    onClick={() => void more("releases")}
                  >
                    加载更早候选
                  </button>
                )}
                {snapshot.next.builds && (
                  <button
                    className="sea-button"
                    disabled={loading}
                    onClick={() => void more("builds")}
                  >
                    加载更早构建
                  </button>
                )}
              </div>
              {!snapshot.releases.length && !state?.candidate_release_id && (
                <EmptyState title="还没有候选版本">先保存原始资料与 Wiki，再冻结候选。</EmptyState>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
function RevisionPicker({
  title,
  items,
  selected,
  toggle,
}: {
  title: string;
  items: Revision[];
  selected: string[];
  toggle: (id: string) => void;
}) {
  return (
    <fieldset className="knowledge-revisions">
      <legend>{title}</legend>
      {items.map((r) => (
        <label className="sea-checkbox" key={r.revision_id}>
          <input
            type="checkbox"
            checked={selected.includes(r.revision_id)}
            onChange={() => toggle(r.revision_id)}
          />
          <span>
            {r.title}
            <small className="knowledge-id">{r.revision_id}</small>
          </span>
        </label>
      ))}
      {!items.length && <p>暂无修订。请先加入原文或知识页。</p>}
    </fieldset>
  );
}
