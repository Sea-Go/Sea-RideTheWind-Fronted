"use client";
import { useEffect, useState } from "react";

import { KnowledgeWorkbench as LiveKnowledgeWorkbench } from "@/features/knowledge/KnowledgeWorkbench";
import { PublishedModule, PublishedReader } from "@/features/knowledge/PublishedKnowledge";
import { WorkbenchModules } from "@/features/knowledge/WorkbenchModules";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Plus,
  Sparkles,
} from "../components/icons";
import { EmptyState, Notice, SeaLink, SectionTitle } from "../components/primitives";
import { useSea } from "../components/SeaShell";
import { activateKnowledge, knowledgePage, seaRequest } from "../data/api";
import { articleParagraphs, citations, modules, release as demoRelease } from "../data/demo";
import type { KnowledgeModule, ReleaseState } from "../data/types";
function useModules() {
  const { demo, ready } = useSea();
  const [items, setItems] = useState<KnowledgeModule[]>(demo ? modules : []);
  const [cursor, setCursor] = useState<string>();
  const [next, setNext] = useState<string>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!demo);
  useEffect(() => {
    if (!ready || demo) return;
    const c = new AbortController();
    knowledgePage(cursor, c.signal)
      .then((r) => {
        setItems(r.items);
        setNext(r.next_cursor);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [demo, ready, cursor]);
  return {
    items,
    error,
    loading,
    next,
    more: () => {
      setLoading(true);
      setCursor(next);
    },
  };
}
export function KnowledgeShelf() {
  const { demo } = useSea();
  const data = useModules();
  return (
    <div className="sea-content">
      <div className="sea-page-heading">
        <div>
          <span className="sea-eyebrow">A LIVING LIBRARY</span>
          <h1>
            知识不是终点，
            <br />
            是通向世界的路。
          </h1>
          <p>原始资料保留来处，知识页连接理解。每个正式版本，都由人认真维护。</p>
        </div>
        <img
          className="sea-heading-art"
          src="/sea/book-orbits.svg"
          alt="原创知识轨道"
          width="340"
          height="210"
        />
      </div>
      <div className="sea-toolbar">
        <div className="sea-tabs">
          <span className="active">全部模块</span>
          <span>原始资料 + Wiki</span>
        </div>
        <SeaLink href="/knowledge/workbench" className="sea-text-link">
          管理员工作台
          <ArrowRight size={16} />
        </SeaLink>
      </div>
      {data.error && <Notice error>知识服务暂不可用：{data.error}</Notice>}
      {data.loading && <p>正在打开书架…</p>}
      <div className="sea-book-grid">
        {data.items.map((m) => (
          <SeaLink key={m.id} href={`/knowledge/${m.id}`} className="sea-book-card">
            <div className="sea-book-art">
              <img
                src={`/sea/${["mountain", "planetarium", "summer", "ocean"].includes(m.image) ? m.image : "book-orbits"}.svg`}
                width="350"
                height="230"
                alt={`${m.title}原创封面`}
              />
              <span className="sea-release">
                {m.release} 已发布{demo ? " · 演示" : ""}
              </span>
            </div>
            <div>
              <span className="sea-eyebrow">{m.category}</span>
              <h2>{m.title}</h2>
              <p>{m.description}</p>
              <small>
                {m.sources} 份资料 · {m.pages} 个知识页 <ArrowRight size={16} />
              </small>
            </div>
          </SeaLink>
        ))}
      </div>
      {!data.items.length && !data.loading && (
        <EmptyState title="等待第一本知识模块">
          当前没有可读取的正式版本。管理员发布成功后，模块才会出现在这里。
        </EmptyState>
      )}
      {data.next && (
        <button className="sea-button" onClick={data.more}>
          下一页模块
        </button>
      )}
      <section className="sea-info-band">
        <BookOpen size={24} />
        <div>
          <h3>从一本书，走向一张知识网。</h3>
          <p>
            一个模块可以包含多份资料。原始资料与人工维护的 Wiki
            分开保存，回答只引用已发布的具体版本。
          </p>
        </div>
      </section>
    </div>
  );
}
export function KnowledgeModulePage({ id }: { id: string }) {
  const { demo } = useSea();
  return demo ? <DemoModulePage key={id} id={id} /> : <PublishedModule key={id} moduleId={id} />;
}
function DemoModulePage({ id }: { id: string }) {
  const { demo } = useSea();
  const [knowledgeModule, setModule] = useState<KnowledgeModule | undefined>(
    demo ? modules.find((m) => m.id === id) : undefined,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!demo);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    seaRequest<KnowledgeModule>(`knowledge/modules/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setModule(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [demo, id]);
  if (!knowledgeModule)
    return (
      <div className="sea-content">
        <SeaLink href="/knowledge">← 返回书架</SeaLink>
        <EmptyState title={loading ? "正在打开模块" : "模块暂不可用"}>
          {error || "该模块尚未发布，或服务等待接入。"}
        </EmptyState>
      </div>
    );
  if (!demo)
    return (
      <div className="sea-content">
        <div className="sea-page-heading">
          <div>
            <h1>{knowledgeModule.title}</h1>
            <p>{knowledgeModule.description}</p>
          </div>
          <span className="sea-pill">{knowledgeModule.release}</span>
        </div>
        <EmptyState title="资料与知识页目录尚未接入">
          模块元数据已读取；需要后端提供发布清单和具体修订目录，才能进入正式阅读。
        </EmptyState>
        <SeaLink href={`/knowledge/${encodeURIComponent(id)}/workbench`} className="sea-button">
          维护此模块
        </SeaLink>
      </div>
    );
  return (
    <div className="sea-content">
      <div className="sea-breadcrumb">
        <SeaLink href="/knowledge">知识书架</SeaLink>
        <span>/</span>
        {knowledgeModule.title}
      </div>
      <section className="sea-module-hero">
        <img
          src={`/sea/${knowledgeModule.image}.svg`}
          width="420"
          height="290"
          alt={`${knowledgeModule.title}原创封面`}
        />
        <div>
          <span className="sea-eyebrow">{knowledgeModule.category} · KNOWLEDGE MODULE</span>
          <h1>{knowledgeModule.title}</h1>
          <p className="sea-lead">{knowledgeModule.subtitle}</p>
          <p>{knowledgeModule.description}</p>
          <div className="sea-meta">
            <span className="sea-pill">{knowledgeModule.release} · 正式版本</span>
            <span>{knowledgeModule.sources} 份资料</span>
            <span>{knowledgeModule.pages} 个知识页</span>
            <span>更新于 {knowledgeModule.updated}</span>
          </div>
          <div className="sea-actions">
            <SeaLink href={`/knowledge/${id}/read`} className="sea-button primary">
              开始阅读
              <ArrowRight size={16} />
            </SeaLink>
            <SeaLink href={`/learn?knowledgeModule=${id}`} className="sea-button">
              <Sparkles size={16} />
              围绕这个模块提问
            </SeaLink>
          </div>
        </div>
      </section>
      <div className="sea-two-col">
        <section>
          <SectionTitle title="维护过的知识页" eyebrow="WIKI · CONNECT THE DOTS" />
          {[
            "山地如何塑造气候与生命",
            "迎风坡与雨影效应",
            "从河谷到雪线：垂直自然带",
            "冰川留下的时间刻度",
          ].map((t, i) => (
            <SeaLink
              key={t}
              href={`/knowledge/${id}/read?chapter=${i + 1}`}
              className="sea-chapter"
            >
              <span>0{i + 1}</span>
              <div>
                <h3>{t}</h3>
                <p>
                  {i === 0
                    ? "从地形抬升出发，建立理解山地的第一张地图。"
                    : "连接资料中的线索，保留每一处可回溯的引用。"}
                </p>
              </div>
              <ArrowRight size={17} />
            </SeaLink>
          ))}
        </section>
        <aside>
          <SectionTitle title="原始资料" eyebrow="SOURCES · KEEP THE ORIGIN" />
          {["山地自然观察笔记", "地形与气候：入门资料", "高山生态补充记录"].map((t, i) => (
            <SeaLink
              href={`/knowledge/${id}/sources?source=${i + 1}`}
              key={t}
              className="sea-source-link"
            >
              <FileText size={21} />
              <div>
                <strong>{t}</strong>
                <p>Markdown · 修订 r{i + 1}</p>
              </div>
              <ArrowRight size={14} />
            </SeaLink>
          ))}
          <div className="sea-note-card">
            <h3>这一版，值得信赖的来处</h3>
            <p>管理员编制、核对资料后手动发布。编制成功和索引就绪都不会自动替换当前版本。</p>
            <SeaLink href={`/knowledge/${encodeURIComponent(id)}/workbench`}>
              查看维护工作台 →
            </SeaLink>
          </div>
        </aside>
      </div>
    </div>
  );
}
export function KnowledgeReader({
  source = false,
  id = "mountain",
  releaseId = "",
  revisionId = "",
  locator = "",
}: {
  source?: boolean;
  id?: string;
  releaseId?: string;
  revisionId?: string;
  locator?: string;
}) {
  const { demo } = useSea();
  return demo ? (
    <DemoKnowledgeReader source={source} id={id} />
  ) : (
    <PublishedReader
      key={`${id}:${releaseId}:${revisionId}:${locator}:${source}`}
      moduleId={id}
      source={source}
      releaseId={releaseId}
      revisionId={revisionId}
      locator={locator}
    />
  );
}
function DemoKnowledgeReader({
  source = false,
  id = "mountain",
}: {
  source?: boolean;
  id?: string;
}) {
  const { demo } = useSea();
  const [saved, setSaved] = useState(false);
  if (!demo)
    return (
      <div className="sea-content">
        <EmptyState title="正式知识阅读待接入">
          读取必须绑定 release 和 revision；当前未连接知识服务，不使用示例正文替代。
        </EmptyState>
      </div>
    );
  return (
    <div className="sea-content">
      <div className="sea-breadcrumb">
        <SeaLink href="/knowledge">知识</SeaLink>
        <span>/</span>
        <SeaLink href={`/knowledge/${id}`}>山地的语言</SeaLink>
        <span>/</span>
        {source ? "原始资料" : "知识阅读"}
      </div>
      <div className="sea-reader-grid">
        <aside className="sea-reader-nav">
          <SeaLink href={`/knowledge/${id}`} className="sea-back">
            <ArrowLeft size={15} />
            山地的语言
          </SeaLink>
          <span className="sea-eyebrow">本模块目录</span>
          {["山地如何塑造气候与生命", "迎风坡与雨影效应", "垂直自然带", "冰川与时间"].map(
            (t, i) => (
              <a key={t} href={`#section-${i + 1}`} className={i === 0 ? "active" : ""}>
                <span>0{i + 1}</span>
                {t}
              </a>
            ),
          )}
          <div className="sea-reader-meta">
            <span className="sea-pill">v3 正式版本 · 演示</span>
            <p>
              Wiki 修订 r4
              <br />
              资料集合 3 份<br />
              更新于 2026.09.10
            </p>
          </div>
          <SeaLink href={`/knowledge/${id}/sources`} className="sea-text-link">
            <FileText size={15} />
            查看原始资料
          </SeaLink>
        </aside>
        <article className="sea-reading">
          <div className="sea-eyebrow">
            {source ? "SOURCE · 原始资料 r2" : "WIKI · 持续维护的知识"}
          </div>
          <h1>{source ? "山地自然观察笔记" : "山地如何塑造\n气候与生命"}</h1>
          <p className="sea-reading-deck">
            从一朵云的形成，到一整片森林的分布。让我们沿着山的高度，读懂地形、气候与生命之间的联系。
          </p>
          <div className="sea-reading-byline">
            <span className="sea-mini-avatar">山</span>Sea 知识编辑组 <span>·</span>约 8 分钟阅读
            <button aria-pressed={saved} onClick={() => setSaved(!saved)}>
              {saved ? "已存入演示阅读清单" : "加入阅读清单"}
            </button>
          </div>
          <figure className="sea-article-art">
            <img
              src="/sea/mountain.svg"
              alt="原创山地、垂直植被与湖泊构图"
              width="840"
              height="390"
            />
            <figcaption>图 01 · 从河谷到雪线，一座山里的多个世界。原创示意插画。</figcaption>
          </figure>
          <h2 id="section-1">01 / 一座山，改变一场雨</h2>
          <p>{articleParagraphs[0]}</p>
          <p>
            {articleParagraphs[1]}
            <a href="#evidence-1" className="sea-citation">
              1
            </a>
          </p>
          <blockquote>
            山地既是地表的起伏，也是空气与水分的路径。<span>— 本页概念提要 · 演示内容</span>
          </blockquote>
          <h2 id="section-2">02 / 翻过山脊，走进另一种气候</h2>
          <p>
            {articleParagraphs[2]}
            <a href="#evidence-2" className="sea-citation">
              2
            </a>
          </p>
          <p>{articleParagraphs[3]}</p>
          <h2 id="section-3">03 / 高度之外，还要看见坡向</h2>
          <p>
            温度通常随海拔上升而降低，但植物也需要水与阳光。观察山地植被时，把海拔、坡向、季节和土壤一同记下，往往比只记住一种树的名字更有帮助。
          </p>
          <div className="sea-learn-inline">
            <Sparkles size={24} />
            <div>
              <strong>这里还有一个好问题</strong>
              <p>为什么同样的海拔，山的两侧会有不同的森林？</p>
            </div>
            <SeaLink href="/learn" className="sea-button">
              继续追问
              <ArrowRight size={16} />
            </SeaLink>
          </div>
          <h2 id="section-4">引用与资料</h2>
          {citations.map((c) => (
            <div className="sea-evidence" id={`evidence-${c.id}`} key={c.id}>
              <span>{c.id}</span>
              <div>
                <strong>{c.title}</strong>
                <p>
                  {c.release} · {c.locator}
                </p>
                <blockquote>{c.excerpt}</blockquote>
              </div>
            </div>
          ))}
        </article>
        <aside className="sea-reading-aside">
          <div className="sea-eyebrow">ON THIS PAGE</div>
          <a href="#section-1">一座山，改变一场雨</a>
          <a href="#section-2">山脊的另一侧</a>
          <a href="#section-3">高度之外</a>
          <a href="#section-4">引用与资料</a>
          <div className="sea-note-card">
            <BookOpen size={22} />
            <h3>有来处的知识</h3>
            <p>当前阅读绑定 v3。未来修订不会改变本次引用。</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
export function KnowledgeWorkbench({ moduleId }: { moduleId?: string }) {
  const { demo } = useSea();
  if (demo) return <DemoKnowledgeWorkbench moduleId={moduleId} />;
  return moduleId ? (
    <LiveKnowledgeWorkbench key={moduleId} moduleId={moduleId} />
  ) : (
    <WorkbenchModules />
  );
}
function DemoKnowledgeWorkbench({ moduleId }: { moduleId?: string }) {
  const { demo, ready } = useSea();
  const selectedModuleId = moduleId || (demo ? "mountain" : "");
  const [state, setState] = useState<ReleaseState | null>(demo ? demoRelease : null);
  const [tab, setTab] = useState("修订比较");
  const [reason, setReason] = useState(demo ? "补充雨影效应说明，修正第 2 节的资料引用。" : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fail, setFail] = useState(false);
  const [draft, setDraft] = useState(
    "## 迎风坡与雨影效应\n湿润空气受地形抬升后冷却、凝结，形成云与降水。\n\n引用：山地自然观察笔记 r2，第 3 章。",
  );
  useEffect(() => {
    if (demo || !ready || !selectedModuleId) return;
    const c = new AbortController();
    seaRequest<ReleaseState>(
      `knowledge/modules/${encodeURIComponent(selectedModuleId)}/releases/current`,
      { signal: c.signal },
    )
      .then((result) => {
        if (!c.signal.aborted) setState(result);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [demo, ready, selectedModuleId]);
  async function publish() {
    if (!state || !selectedModuleId || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        if (fail) throw new Error("演示发布冲突：预期指针已变化。旧版本保留，请重新核对差异。");
        setState({
          ...state,
          active_release_id: state.candidate_release_id,
          pointer_revision: state.pointer_revision + 1,
        });
        setMessage("演示发布成功：活动指针已切换到 v4，仅在本页演示状态中生效。");
      } else {
        const result = await activateKnowledge(selectedModuleId, state, reason.trim());
        setState(result);
        setMessage("发布成功，活动版本已更新。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败，旧版本保留");
    } finally {
      setBusy(false);
    }
  }
  if (!demo)
    return (
      <div className="sea-content">
        <div className="sea-page-heading">
          <div>
            <h1>知识工作台</h1>
            <p>
              {selectedModuleId
                ? `当前模块：${selectedModuleId} · 发布服务实际状态；未提供的数据保持未知。`
                : "先从知识书架选择需要维护的模块。"}
            </p>
          </div>
        </div>
        {error && <Notice error>{error} 输入与当前版本保留。</Notice>}
        {message && <Notice>{message}</Notice>}
        {state ? (
          <>
            <div className="sea-workbench-summary">
              <div>
                <span>当前生效</span>
                <strong>{state.active_release_id}</strong>
              </div>
              <div>
                <span>候选版本</span>
                <strong>{state.candidate_release_id}</strong>
              </div>
              <div>
                <span>编制状态</span>
                <strong>未提供</strong>
              </div>
              <div>
                <span>索引构建</span>
                <strong>{state.build_state}</strong>
              </div>
            </div>
            <EmptyState title="修订比较待接入">
              未取得固定修订正文，不展示示例差异。发布检查以服务端对该清单的实际校验为准。
            </EmptyState>
            <label className="sea-field">
              发布说明
              <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button
              className="sea-button primary"
              disabled={
                busy ||
                state.build_state !== "READY" ||
                state.active_release_id === state.candidate_release_id ||
                !reason.trim()
              }
              onClick={publish}
            >
              手动发布 {state.candidate_release_id}
            </button>
          </>
        ) : (
          <EmptyState
            title={selectedModuleId ? "知识发布接口待接入" : "选择要维护的知识模块"}
            action={
              <SeaLink href="/knowledge" className="sea-button">
                打开知识书架
              </SeaLink>
            }
          >
            {selectedModuleId
              ? "尚未读取到当前活动指针与候选构建状态，不提供发布成功状态。"
              : "在模块详情进入维护工作台，读取和发布都会绑定同一个模块。"}
          </EmptyState>
        )}
      </div>
    );
  return (
    <div className="sea-content">
      <div className="sea-breadcrumb">
        <SeaLink href="/knowledge">知识</SeaLink>
        <span>/</span>管理员工作台
      </div>
      <div className="sea-page-heading compact">
        <div>
          <span className="sea-eyebrow">KNOWLEDGE STUDIO</span>
          <h1>让每一次修订，有据可循。</h1>
          <p>山地的语言 · 资料、编制、候选与发布分别管理。</p>
        </div>
        <SeaLink href="/knowledge/mountain/read" className="sea-button">
          预览当前正式版
          <ArrowRight size={16} />
        </SeaLink>
      </div>
      <div className="sea-workbench-summary">
        <div>
          <span>当前生效</span>
          <strong>{state ? state.active_release_id.replace("mountain-", "") : "待接入"}</strong>
          <small>活动指针 revision {state?.pointer_revision ?? "未知"}</small>
        </div>
        <div>
          <span>候选版本</span>
          <strong>{state ? "v4" : "待接入"}</strong>
          <small>独立冻结的发布清单</small>
        </div>
        <div>
          <span>编制状态</span>
          <strong>{state ? "已完成" : "待接入"}</strong>
          <small>等待管理员审阅</small>
        </div>
        <div>
          <span>索引构建</span>
          <strong>{state?.build_state === "READY" ? "三路就绪" : "待接入"}</strong>
          <small>就绪不等于已发布</small>
        </div>
      </div>
      {error && <Notice error>{error} 输入与原生效配置保留。</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="sea-workbench-grid">
        <aside>
          <div className="sea-note-card">
            <span className="sea-eyebrow">WORKSPACE</span>
            <h3>山地的语言</h3>
            <p>3 份原始资料 · 12 个 Wiki 页</p>
          </div>
          {["资料与编制", "修订比较", "候选发布"].map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`sea-workbench-step ${tab === t ? "active" : ""}`}
            >
              <span>0{i + 1}</span>
              {t}
              <ArrowRight size={14} />
            </button>
          ))}
          <div className="sea-muted sea-small">
            已编制的候选内容可继续编辑。再次编制不覆盖人工维护的正式修订。
          </div>
        </aside>
        <section>
          <div className="sea-panel-head">
            <div>
              <span className="sea-eyebrow">
                {tab === "修订比较" ? "REVISION COMPARE" : "CANDIDATE WORKSPACE"}
              </span>
              <h2>{tab}</h2>
            </div>
            <span className="sea-pill">{demo ? "演示数据" : "等待服务"}</span>
          </div>
          {tab === "资料与编制" ? (
            <>
              <div className="sea-source-link">
                <FileText />
                <div>
                  <strong>山地自然观察笔记</strong>
                  <p>Markdown · r2 · 示例资料</p>
                </div>
              </div>
              <label className="sea-field">
                编制规则与人工修订
                <textarea rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} />
              </label>
              <button
                className="sea-button"
                onClick={() => {
                  setMessage(demo ? "演示候选已保留，尚未发布。" : "编制接口待接入；输入已保留。");
                  if (!demo) setError("尚无已连接的编制服务");
                }}
              >
                <Sparkles size={16} />
                保存候选修订
              </button>
            </>
          ) : (
            <>
              <div className="sea-diff-head">
                <span>当前正式版 · v3 / r3</span>
                <span>候选版本 · v4 / r4</span>
              </div>
              <div className="sea-diff">
                <div>
                  <span className="sea-diff-number">14</span>
                  <p>山地的迎风坡通常比背风坡湿润。</p>
                  <p className="removed">− 山的另一侧几乎不会降雨。</p>
                  <p>植被变化与海拔有关。</p>
                  <div className="sea-diff-foot">原引用：观察笔记 r1，第 2 节</div>
                </div>
                <div>
                  <span className="sea-diff-number">14</span>
                  <p>山地的迎风坡通常比背风坡湿润。</p>
                  <p className="added">
                    + 背风侧的相对干燥取决于气流、地形与季节，不能解释为没有降雨。
                  </p>
                  <p className="added">+ 植被还受坡向、水分和土壤共同影响。</p>
                  <div className="sea-diff-foot">更新引用：观察笔记 r2，第 3 章</div>
                </div>
              </div>
              <div className="sea-validation">
                <h3>发布前核对</h3>
                {[
                  "资料与引用结构完整",
                  "Dense / Sparse / Token 多向量产物就绪",
                  "候选清单与构建回执一致",
                ].map((t) => (
                  <p key={t}>
                    {state?.build_state === "READY" ? <Check size={16} /> : <span>—</span>}
                    {t}
                    <span>{state ? "示例通过" : "待接入"}</span>
                  </p>
                ))}
                <p>
                  <span>—</span>事实准确性与质量评测<span>未测 · 非本期阻断门槛</span>
                </p>
              </div>
              <label className="sea-field">
                发布说明
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              {demo && (
                <label className="sea-checkbox">
                  <input
                    type="checkbox"
                    checked={fail}
                    onChange={(e) => setFail(e.target.checked)}
                  />
                  演示版本冲突，验证失败保留旧版
                </label>
              )}
              <div className="sea-publish-bar">
                <div>
                  <strong>发布后，下一次检索使用新版本。</strong>
                  <p>既有回答仍绑定各自实际引用的版本。</p>
                </div>
                <button
                  className="sea-button primary"
                  disabled={
                    busy ||
                    state?.build_state !== "READY" ||
                    state.active_release_id === state.candidate_release_id ||
                    !reason.trim()
                  }
                  onClick={publish}
                >
                  {busy ? "正在发布…" : `${demo ? "演示：" : ""}手动发布 v4`}
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
