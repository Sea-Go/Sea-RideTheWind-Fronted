"use client";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { ArrowRight, BookOpen, Search, Settings2, Sparkles, X } from "../components/icons";
import { EmptyState, Notice, SeaLink, StoryRow } from "../components/primitives";
import { useSea } from "../components/SeaShell";
import { citationPath, searchKnowledge, suggest } from "../data/api";
import { citations, stories } from "../data/demo";
import type { SearchResult } from "../data/types";
const demoResult: SearchResult = {
  hits: stories.slice(0, 3),
  answer:
    "山地通过改变空气的运动，连接起气候与生命。湿润气流沿迎风坡抬升、冷却并形成降水；越过山脊后，空气下沉增温，背风侧相对干燥。海拔、坡向与水分共同影响植被分布。",
  citations,
  status: "complete",
  request_id: "demo-search-001",
  lanes: [
    { name: "Dense 稠密召回", status: "演示完成", candidates: 42 },
    { name: "Sparse 稀疏召回", status: "演示完成", candidates: 38 },
    { name: "Token 多向量召回", status: "演示完成", candidates: 31 },
  ],
  gaps: ["局地差异仍需要具体山体与季节的观测资料。"],
};
export function SearchPage({
  initialQuery = "山地如何影响气候与植被？",
}: {
  initialQuery?: string;
}) {
  const { demo } = useSea();
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(demo ? initialQuery : "");
  const [depth, setDepth] = useState("fast");
  const [resultDepth, setResultDepth] = useState("fast");
  const [composing, setComposing] = useState(false);
  const [intelligence, setIntelligence] = useState("medium");
  const [result, setResult] = useState<SearchResult | null>(demo ? demoResult : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [debug, setDebug] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  useEffect(() => {
    if (composing || !touched || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const c = new AbortController();
    const timer = setTimeout(() => {
      if (demo) {
        setSuggestions(["山地如何影响降雨？", "雨影效应与植被分布", "从河谷到雪线的自然带"]);
        return;
      }
      suggest(query, c.signal)
        .then((r) => setSuggestions((r.items ?? []).flatMap((x) => (x.title ? [x.title] : []))))
        .catch(() => {
          if (!c.signal.aborted) setSuggestions([]);
        });
    }, 280);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query, demo, touched, composing]);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const id = ++version.current;
    setLoading(true);
    setError("");
    setSuggestions([]);
    setTouched(false);
    try {
      const data = demo
        ? { ...demoResult, request_id: `demo-${id}`, hits: stories.slice(0, 3) }
        : await searchKnowledge(query.trim(), depth, intelligence, c.signal);
      if (id === version.current) {
        setResult(data);
        setSubmitted(query.trim());
        setResultDepth(depth);
      }
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : "搜索失败");
    } finally {
      if (id === version.current) setLoading(false);
    }
  }
  return (
    <div className="sea-content sea-search-page">
      <div className="sea-search-intro">
        <span className="sea-eyebrow">FOLLOW THE QUESTION</span>
        <h1>从一个问题，走向更多理解。</h1>
        <p>检索正式知识与已发布文章，让每个答案都有来处。</p>
      </div>
      <form className="sea-search-form" onSubmit={submit}>
        <div className="sea-large-search">
          <Search size={23} />
          <input
            aria-label="搜索问题"
            value={query}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onChange={(e) => {
              setQuery(e.target.value);
              setTouched(true);
            }}
            placeholder="你想了解什么？"
          />
          <button className="sea-button primary" type="submit" disabled={loading}>
            {loading ? "搜索中…" : "搜索"}
            <ArrowRight size={17} />
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="sea-suggestions">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => {
                  setQuery(s);
                  setSuggestions([]);
                  setTouched(false);
                }}
              >
                <Search size={15} />
                {s}
                <span>填入</span>
              </button>
            ))}
          </div>
        )}
        <div className="sea-search-options">
          <div className="sea-segment" aria-label="搜索深度">
            <button type="button" aria-pressed={depth === "fast"} onClick={() => setDepth("fast")}>
              快搜
            </button>
            <button
              type="button"
              aria-pressed={depth === "detailed"}
              onClick={() => setDepth("detailed")}
            >
              详搜
            </button>
          </div>
          <label>
            智能等级
            <select value={intelligence} onChange={(e) => setIntelligence(e.target.value)}>
              <option value="low">低 · 直接查找</option>
              <option value="medium">中 · 理解问题</option>
              <option value="high">高 · 深入复核</option>
            </select>
          </label>
          <span>正式搜索仅在提交时开始</span>
        </div>
      </form>
      {error && (
        <Notice error>
          搜索未完成：{error}。下方若有结果，仍属于上一次查询。
          <button onClick={() => submit()}>重新提交</button>
        </Notice>
      )}
      {loading && (
        <Notice>
          正在检索与核对证据…
          <button
            onClick={() => {
              controller.current?.abort();
              version.current++;
              setLoading(false);
              setError("已取消本次搜索，原结果保留");
            }}
          >
            取消
          </button>
        </Notice>
      )}
      {result ? (
        <div className="sea-search-results">
          <section>
            <div className="sea-results-meta">
              <strong>{submitted}</strong>
              <span>
                {demo ? "演示结果 · " : ""}
                {result.hits.length} 条已加载 · {resultDepth === "fast" ? "快搜" : "详搜"}
              </span>
            </div>
            {result.answer && (
              <article className="sea-answer-card">
                <div className="sea-answer-heading">
                  <span>
                    <Sparkles size={18} />
                    从证据中得到的回答
                  </span>
                  <span className="sea-pill">
                    {result.status === "complete" ? "有来源的概览" : "部分结果"}
                  </span>
                </div>
                <p>
                  {result.answer}
                  {result.citations?.map((c) => (
                    <a key={c.id} className="sea-citation" href={`#search-citation-${c.id}`}>
                      {c.id}
                    </a>
                  ))}
                </p>
                <div className="sea-answer-insight">
                  <strong>再往前一步</strong>
                  <span>{result.gaps?.[0] ?? "可以打开来源，继续核对具体段落。"}</span>
                </div>
                <SeaLink href="/learn" className="sea-text-link">
                  带着这个问题继续对话
                  <ArrowRight size={16} />
                </SeaLink>
              </article>
            )}
            <div className="sea-tabs">
              <span className="active">全部证据与文章</span>
              <span>正式知识</span>
              <span>社区文章</span>
            </div>
            {result.hits.map((s) => (
              <StoryRow key={s.id} story={s} />
            ))}
            {!result.hits.length && (
              <EmptyState title="还没有找到足够的证据">
                可以缩小问题范围，或更换关键词；不会用评论与未发布内容补足答案。
              </EmptyState>
            )}
            <button className="sea-debug-toggle" onClick={() => setDebug(!debug)}>
              <Settings2 size={15} />
              {debug ? "收起" : "打开"}开发者调试视图
            </button>
            {debug && (
              <div className="sea-debug">
                <h3>搜索三路独立召回 → 融合排序 → 证据 → 总结</h3>
                <p>
                  depth 与 intelligence 不代表检索路数。工具交付是独立调用方式；此页请求 summary。
                </p>
                <pre>
                  {JSON.stringify(
                    {
                      request_id: result.request_id,
                      delivery: "summary",
                      lanes: result.lanes ?? "未提供",
                      tool_result: "工具交付路径待接入",
                      gaps: result.gaps,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </section>
          <aside className="sea-citations-panel">
            <span className="sea-eyebrow">BACK TO THE SOURCE</span>
            <h3>这份回答的来处</h3>
            <p>固定到本次使用的资料版本</p>
            {result.citations?.map((c) => (
              <div className="sea-citation-card" id={`search-citation-${c.id}`} key={c.id}>
                <div>
                  <span className="sea-citation">{c.id}</span>
                  <small>
                    {c.kind === "wiki"
                      ? "Wiki 知识页"
                      : c.kind === "article"
                        ? "已发布文章"
                        : "原始资料"}
                  </small>
                </div>
                <h4>{c.title}</h4>
                <p>{c.release}</p>
                <blockquote>{c.excerpt}</blockquote>
                {citationPath(c) ? (
                  <SeaLink href={citationPath(c)!}>
                    {c.locator}
                    <ArrowRight size={13} />
                  </SeaLink>
                ) : (
                  <span className="sea-muted sea-small">修订定位待接入</span>
                )}
              </div>
            ))}
            <div className="sea-note-card">
              <BookOpen size={21} />
              <h4>只在有依据的范围内回答</h4>
              <p>正式知识与已发布文章参与检索。评论、草稿与未发布候选不作为证据。</p>
            </div>
          </aside>
        </div>
      ) : (
        <EmptyState title="把想知道的，写在这里">
          快搜适合直接问题；详搜用于更多资料核对。输入联想不会启动正式检索与模型总结。
        </EmptyState>
      )}
      <SeaLink href="/dashboard/search" className="sea-legacy-search">
        前往原有社区搜索入口 →
      </SeaLink>
    </div>
  );
}
