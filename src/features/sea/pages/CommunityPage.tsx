"use client";
import { useState } from "react";

import { ArrowLeft, ArrowRight, Plus } from "../components/icons";
import { EmptyState, Notice, SeaLink, SectionTitle, StoryRow } from "../components/primitives";
import { useCommunity } from "../hooks/useCatalog";
export function CommunityPage() {
  const feed = useCommunity();
  const [tab, setTab] = useState("全部");
  const visible = tab === "全部" ? feed.items : feed.items.filter((s) => s.topic.includes(tab));
  return (
    <div className="sea-content">
      <div className="sea-page-heading">
        <div>
          <span className="sea-eyebrow">THE SEA COMMUNITY</span>
          <h1>每一种视角，都是新的海岸。</h1>
          <p>那些认真观察、自由思考与值得分享的日常。</p>
        </div>
        <SeaLink href="/editor" className="sea-button primary">
          <Plus size={17} />
          写一篇文章
        </SeaLink>
      </div>
      <div className="sea-two-col">
        <section>
          <div className="sea-tabs">
            {["全部", "自然", "天文", "阅读"].map((t) => (
              <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          {feed.error && (
            <Notice error>
              无法更新：{feed.error}。已加载内容保留。
              <button onClick={feed.refresh}>重试更新</button>
            </Notice>
          )}
          {feed.loading && <p role="status">正在加载这一页…</p>}
          {visible.map((s) => (
            <StoryRow key={s.id} story={s} />
          ))}
          {!feed.loading && !visible.length && (
            <EmptyState title="这一页暂时没有内容">换一个主题，或稍后再回来看看。</EmptyState>
          )}
          <div className="sea-pagination">
            <button
              className="sea-button"
              disabled={feed.page === 1 || feed.loading}
              onClick={feed.previous}
            >
              <ArrowLeft size={14} />
              上一页
            </button>
            <span>第 {feed.page} 页 · 每页最多 8 篇</span>
            <button
              className="sea-button"
              disabled={!feed.hasMore || feed.loading}
              onClick={feed.next}
            >
              下一页
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <aside>
          <div className="sea-reading-card">
            <span className="sea-eyebrow">FIELD NOTES</span>
            <h3>
              把路上的风，
              <br />
              写成自己的故事。
            </h3>
            <img src="/sea/mountain.svg" alt="原创群峰" width="300" height="180" />
            <SeaLink href="/dashboard/travel-agent">
              继续旅行探索 <ArrowRight size={15} />
            </SeaLink>
          </div>
          <SectionTitle title="熟悉的社区，都还在" />
          {[
            ["/profile/favorites", "我的收藏"],
            ["/profile/follow", "关注的人"],
            ["/profile/articles", "我的文章"],
            ["/messages", "评论与消息"],
          ].map(([href, label]) => (
            <SeaLink key={href} href={href} className="sea-utility-link">
              {label}
              <ArrowRight size={14} />
            </SeaLink>
          ))}
        </aside>
      </div>
    </div>
  );
}
