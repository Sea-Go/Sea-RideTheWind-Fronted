"use client";
import { useEffect, useState } from "react";

import { createArticle, updateArticle } from "@/services/article";
import { getAuthToken } from "@/services/auth";
import { recordRecoEvents } from "@/services/reco";

import { ArrowRight, Bookmark, Heart, MessageCircle, Plus, Sparkles } from "../components/icons";
import { EmptyState, Notice, SeaLink, StoryRow } from "../components/primitives";
import { useSea } from "../components/SeaShell";
import { seaRequest } from "../data/api";
import { articleParagraphs, stories } from "../data/demo";
import type { Story } from "../data/types";
import { useExposure } from "../hooks/useExposure";
export function InterestsPage() {
  const { demo } = useSea();
  const [items, setItems] = useState<Story[]>(demo ? stories.slice(0, 3) : []);
  const [requestId, setRequestId] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(["山地与自然", "阅读与思考", "天文与星空"]);
  const container = useExposure(requestId, !demo);
  useEffect(() => {
    if (demo) return;
    const c = new AbortController();
    seaRequest<{ items: Story[]; request_id: string }>("intelligence/recommendations?limit=12", {
      signal: c.signal,
    })
      .then((r) => {
        setItems(r.items);
        setRequestId(r.request_id);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [demo]);
  async function feedback(id: string) {
    try {
      if (!demo) {
        if (!requestId) throw new Error("缺少推荐归因 ID");
        const accepted = await recordRecoEvents({
          events: [
            {
              rec_request_id: requestId,
              article_id: id,
              surface: "sea-explore",
              event_type: "dislike",
            },
          ],
        });
        if (accepted.accepted < 1) throw new Error("服务未确认接收反馈，内容已保留");
      }
      setItems((list) => list.filter((s) => s.id !== id));
      setMessage(
        demo ? "演示反馈已记录，仅影响当前页面。" : "反馈已提交；后续推荐会参考这次明确反馈。",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "反馈失败");
    }
  }
  return (
    <div className="sea-content">
      <div className="sea-page-heading">
        <div>
          <span className="sea-eyebrow">YOUR OWN HORIZON</span>
          <h1>兴趣，是慢慢长出来的。</h1>
          <p>了解 Sea 如何认识你的好奇心，也随时告诉它你想改变的方向。</p>
        </div>
        <SeaLink href="/profile" className="sea-button">
          进入个人空间
          <ArrowRight size={15} />
        </SeaLink>
      </div>
      <div className="sea-two-col">
        <section>
          <div className="sea-interest-card">
            <h2>你的探索线索</h2>
            <p>
              {demo ? "以下是示例兴趣与来源，不代表真实用户模型。" : "兴趣来源与纠正服务待接入。"}
            </p>
            <div className="sea-interest-tags">
              {(demo ? selected : []).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setSelected((s) => s.filter((x) => x !== t));
                    setMessage("演示：移除此兴趣，不改变目标、计划或日历。");
                  }}
                >
                  {t}
                  <span>×</span>
                </button>
              ))}
            </div>
            {demo && (
              <div className="sea-interest-facts">
                <div>
                  <strong>山地与自然</strong>
                  <span>你主动选择 · 2026.09.10</span>
                </div>
                <div>
                  <strong>阅读与思考</strong>
                  <span>来自明确收藏反馈 · 示例</span>
                </div>
                <div>
                  <strong>天文与星空</strong>
                  <span>最近阅读关联 · 待你确认</span>
                </div>
              </div>
            )}
            <SeaLink href="/onboarding/questionnaire" className="sea-text-link">
              编辑原有兴趣问卷
              <ArrowRight size={15} />
            </SeaLink>
          </div>
          {message && <Notice>{message}</Notice>}
          {error && <Notice error>待接入：{error}</Notice>}
          <div className="sea-section-title">
            <div>
              <span className="sea-eyebrow">MORE TO DISCOVER</span>
              <h2>沿着这些线索，继续发现</h2>
            </div>
            <span className="sea-pill">{demo ? "示例推荐" : "真实推荐"}</span>
          </div>
          <div ref={container}>
            {items.map((s, i) => (
              <StoryRow key={s.id} story={s} rank={i} onFeedback={feedback} />
            ))}
          </div>
          {!items.length && (
            <EmptyState title="还没有可用的推荐">
              你仍然可以直接逛社区，不必先建立目标或计划。
            </EmptyState>
          )}
        </section>
        <aside>
          <div className="sea-note-card">
            <Sparkles size={24} />
            <h3>你对反馈有解释权</h3>
            <p>一次浏览不等于长期兴趣；没有看到的内容，也不会被当成你不喜欢。</p>
            <p>实际进入可视区后，才记录曝光。</p>
          </div>
          <div className="sea-note-card">
            <h3>用户模型的边界</h3>
            <p>
              Ontology
              更新只刷新用户模型与用户塔表示。内容塔、排序策略分别管理，不自动修改目标、计划或日历。
            </p>
            <dl className="sea-mini-dl">
              <dt>用户模型版本</dt>
              <dd>{demo ? "演示 v7" : "未知"}</dd>
              <dt>用户表示</dt>
              <dd>{demo ? "演示待刷新" : "待接入"}</dd>
              <dt>排序策略版本</dt>
              <dd>未提供</dd>
            </dl>
          </div>
          <SeaLink href="/dashboard/recommend" className="sea-button">
            原有个性化推荐
            <ArrowRight size={15} />
          </SeaLink>
        </aside>
      </div>
    </div>
  );
}
export function DemoArticle({ id }: { id: string }) {
  const { demo } = useSea();
  const story = stories.find((s) => s.id === id) ?? stories[0];
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([
    "原来山的两侧，还有这样不同的世界。下次徒步会更认真地观察云的方向。",
  ]);
  if (!demo)
    return (
      <EmptyState title="示例文章仅在演示模式展示">真实文章使用原有文章服务与互动接口。</EmptyState>
    );
  return (
    <div className="sea-content">
      <div className="sea-breadcrumb">
        <SeaLink href="/community">社区</SeaLink>
        <span>/</span>
        {story.topic}
      </div>
      <div className="sea-article-layout">
        <article className="sea-reading">
          <span className="sea-eyebrow">FIELD NOTES · 自然观察</span>
          <h1>{story.title}</h1>
          <p className="sea-reading-deck">{story.brief}</p>
          <div className="sea-reading-byline">
            <span className="sea-mini-avatar">林</span>
            <strong>{story.author}</strong>
            <span>2026.09.10 · {story.readTime}</span>
            <button aria-pressed={followed} onClick={() => setFollowed(!followed)}>
              {followed ? "已关注 · 演示" : "+ 关注作者"}
            </button>
          </div>
          <figure className="sea-article-art">
            <img
              src={`/sea/${story.image}.svg`}
              width="840"
              height="400"
              alt="Sea 原创自然主题文章插画"
            />
            <figcaption>Sea 原创插画 · 本文及互动均为设计演示</figcaption>
          </figure>
          <h2>先看见，再慢慢理解</h2>
          {articleParagraphs.slice(0, 2).map((p) => (
            <p key={p}>{p}</p>
          ))}
          <blockquote>一次观察告诉我们发生了什么，长期的记录帮助我们理解为什么。</blockquote>
          <h2>山的另一面，还有新的故事</h2>
          {articleParagraphs.slice(2).map((p) => (
            <p key={p}>{p}</p>
          ))}
          <div className="sea-article-interactions">
            <button className="sea-button" aria-pressed={liked} onClick={() => setLiked(!liked)}>
              <Heart size={16} />
              {liked ? "已赞同" : "赞同"} {(story.likes ?? 0) + (liked ? 1 : 0)}
            </button>
            <button className="sea-button" aria-pressed={saved} onClick={() => setSaved(!saved)}>
              <Bookmark size={16} />
              {saved ? "已收藏 · 演示" : "收藏"}
            </button>
            <SeaLink href="/editor" className="sea-button">
              编辑文章
            </SeaLink>
          </div>
          <section className="sea-comments">
            <h2>
              一起聊聊 <span>{comments.length}</span>
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) {
                  setComments((c) => [...c, comment.trim()]);
                  setComment("");
                }
              }}
            >
              <label className="sea-field">
                写下你的观察
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="新的视角，从你的观察开始…"
                />
              </label>
              <button className="sea-button primary" disabled={!comment.trim()}>
                发布演示评论
                <MessageCircle size={16} />
              </button>
            </form>
            {comments.map((c, i) => (
              <div className="sea-comment" key={i}>
                <span className="sea-mini-avatar">{i === 0 ? "苔" : "林"}</span>
                <div>
                  <strong>
                    {i === 0 ? "苔生" : "你"}
                    <small>演示评论</small>
                  </strong>
                  <p>{c}</p>
                </div>
              </div>
            ))}
          </section>
        </article>
        <aside>
          <div className="sea-note-card">
            <h3>林间来信</h3>
            <p>在山野与日常之间，记录那些值得慢慢理解的事情。</p>
            <button
              className="sea-button"
              aria-pressed={followed}
              onClick={() => setFollowed(!followed)}
            >
              {followed ? "已关注" : "关注作者"}
            </button>
          </div>
          <div className="sea-reading-card">
            <h3>
              让这份好奇，
              <br />
              继续走远一点。
            </h3>
            <img src="/sea/book-mountain.svg" alt="山地知识模块封面" width="270" height="160" />
            <SeaLink href="/knowledge/mountain">
              阅读相关知识
              <ArrowRight size={15} />
            </SeaLink>
          </div>
        </aside>
      </div>
    </div>
  );
}
export function EditorPage() {
  const { demo } = useSea();
  const [title, setTitle] = useState(demo ? "在山的背面，重新理解一朵云的旅行" : "");
  const [brief, setBrief] = useState(demo ? stories[0].brief : "");
  const [content, setContent] = useState(
    demo ? `## 先看见，再慢慢理解\n\n${articleParagraphs.join("\n\n")}` : "",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function publish() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        setMessage("演示提交完成。真实文章仍须经过既有审核与同步流程，不代表立即发布。");
      } else {
        const token = getAuthToken();
        if (!token) throw new Error("请登录后发布；输入已保留");
        const result = await createArticle(token, {
          title,
          brief,
          content,
          manual_type_tag: "自然观察",
        });
        if (result.code !== 200) throw new Error(result.msg);
        setMessage("提交成功，文章进入既有审核与同步流程。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，输入保留");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sea-content sea-editor">
      <div className="sea-page-heading compact">
        <div>
          <span className="sea-eyebrow">WRITE YOUR OWN FIELD NOTES</span>
          <h1>给新的发现，留一个位置。</h1>
        </div>
        <SeaLink href="/post" className="sea-button">
          完整 Markdown 编辑与图片上传
          <ArrowRight size={16} />
        </SeaLink>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <label className="sea-field">
        文章标题
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="写一个清楚、具体的标题"
          maxLength={160}
        />
      </label>
      <label className="sea-field">
        摘要
        <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} />
      </label>
      <div className="sea-editor-body">
        <label className="sea-field">
          正文 · Markdown
          <textarea rows={20} value={content} onChange={(e) => setContent(e.target.value)} />
        </label>
        <aside className="sea-note-card">
          <h3>把故事说清楚</h3>
          <p>具体的观察、真实的引用和自己的理解，会让分享更值得阅读。</p>
          <p>图片上传、封面生成与已有 Markdown 编辑器在原发布入口继续可用。</p>
          <p>提交失败保留输入，只有服务确认后才显示成功。</p>
        </aside>
      </div>
      <button
        onClick={publish}
        className="sea-button primary"
        disabled={busy || !title.trim() || !content.trim()}
      >
        {busy ? "提交中…" : demo ? "演示提交文章" : "提交文章"}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
export function CompanionPage() {
  return (
    <div className="sea-content">
      <section className="sea-companion-hero">
        <img src="/sea/whale.svg" alt="原创 WhaleHall 鲸鱼桌宠" width="240" height="240" />
        <span className="sea-eyebrow">WHALEHALL · 桌面上的海</span>
        <h1>
          在屏幕的一角，
          <br />
          陪你探索更大的世界。
        </h1>
        <p>
          WhaleHall 是 Sea 的桌宠客户端，承接本机交互、桌面能力与 Agent
          陪伴。当前网页入口保留产品关系，安装包与跨端会话尚待接入。
        </p>
        <div className="sea-actions">
          <SeaLink href="/learn" className="sea-button primary">
            先在网页一起学习
            <ArrowRight size={16} />
          </SeaLink>
          <SeaLink href="/dashboard/travel-agent" className="sea-button">
            去旅行探索
          </SeaLink>
        </div>
      </section>
    </div>
  );
}
