"use client";
import { ArrowRight, BookOpen, Compass, MessageCircle, Plus, Search } from "../components/icons";
import { EmptyState, Notice, SeaLink, SectionTitle, StoryRow } from "../components/primitives";
import { useSea } from "../components/SeaShell";
import { modules } from "../data/demo";
import { useCommunity } from "../hooks/useCatalog";
export function HomePage() {
  const { theme, demo } = useSea();
  const feed = useCommunity();
  return (
    <div className="sea-content">
      <section className="sea-hero">
        <div className="sea-hero-copy">
          <span className="sea-eyebrow">RIDE THE WIND · 与世界保持好奇</span>
          <h1>
            让每一份好奇，
            <br />
            都有<span>更远的回响。</span>
          </h1>
          <p>
            在社区遇见新的视角，在知识中连接线索。
            <br />和 Sea 一起，把世界慢慢读懂。
          </p>
          <div className="sea-actions">
            <SeaLink href="/knowledge" className="sea-button primary">
              漫游知识世界
              <ArrowRight size={17} />
            </SeaLink>
            <SeaLink href="/learn" className="sea-button quiet">
              <MessageCircle size={17} />
              从一个问题开始
            </SeaLink>
          </div>
          <div className="sea-hero-note">
            <span className="sea-orbit-mark">✳</span>
            <span>今天，也给未知留一点位置。</span>
          </div>
        </div>
        <div className={`sea-hero-art sea-art-${theme}`}>
          <img
            src={`/sea/${theme}.svg`}
            alt={
              theme === "mountain"
                ? "原创雪山群峰、森林与湖泊插画"
                : theme === "planetarium"
                  ? "原创天文馆轨道与星图插画"
                  : "纯黑夏夜中天上银河与地上萤火虫河流"
            }
            width="710"
            height="450"
            fetchPriority="high"
          />
          <div className="sea-art-label">
            <span>SEA FIELD NOTES / 01</span>
            <strong>
              {theme === "mountain"
                ? "山很远，好奇心很近。"
                : theme === "planetarium"
                  ? "向内阅读，向外看星。"
                  : "天上银河，地下萤河。"}
            </strong>
            <span>
              {theme === "mountain"
                ? "神圣雪山 · 原创自然系列"
                : theme === "planetarium"
                  ? "天文馆 · 原创探索系列"
                  : "蝉鸣夏夜 · 原创自然系列"}
            </span>
          </div>
        </div>
      </section>
      <section className="sea-paths">
        <SeaLink href="/community">
          <span className="sea-path-icon blue">
            <Compass />
          </span>
          <div>
            <h3>遇见有趣的人与想法</h3>
            <p>社区里的观察、故事与认真分享</p>
          </div>
          <ArrowRight />
        </SeaLink>
        <SeaLink href="/knowledge">
          <span className="sea-path-icon sage">
            <BookOpen />
          </span>
          <div>
            <h3>把碎片，连成知识</h3>
            <p>原始资料与持续生长的 Wiki</p>
          </div>
          <ArrowRight />
        </SeaLink>
        <SeaLink href="/learn">
          <span className="sea-path-icon butter">
            <MessageCircle />
          </span>
          <div>
            <h3>让问题带你往前走</h3>
            <p>有来源、可追问的学习对话</p>
          </div>
          <ArrowRight />
        </SeaLink>
      </section>
      <div className="sea-two-col">
        <section>
          <SectionTitle
            eyebrow="A LITTLE CURIOSITY, EVERY DAY"
            title="值得停留的片刻"
            link="探索社区"
            href="/community"
          />
          <div className="sea-tabs">
            <span className="active">{demo ? "编辑精选" : "最新分享"}</span>
            <SeaLink href="/interests">为你探索</SeaLink>
            <SeaLink href="/community">最新分享</SeaLink>
          </div>
          {feed.error && (
            <Notice error>
              {feed.error} · 保留已显示内容。<button onClick={feed.refresh}>重试</button>
            </Notice>
          )}
          {feed.loading && <p className="sea-muted">正在读取社区…</p>}
          {feed.items.map((s) => (
            <StoryRow key={s.id} story={s} />
          ))}
          {!feed.loading && !feed.items.length && (
            <EmptyState title="期待下一次相遇">
              社区暂未返回文章。连接服务后，这里会展示真实分享。
            </EmptyState>
          )}
          <SeaLink className="sea-wide-link" href="/community">
            继续发现更多
            <ArrowRight size={16} />
          </SeaLink>
        </section>
        <aside className="sea-home-aside">
          <div className="sea-reading-card">
            <div className="sea-eyebrow">YOUR NEXT CHAPTER</div>
            <h3>给好奇心，一个书架</h3>
            <p>
              从一本资料出发，
              <br />
              读到更辽阔的世界。
            </p>
            <img
              src="/sea/book-orbits.svg"
              alt="原创轨道图书封面"
              width="240"
              height="150"
              loading="lazy"
            />
            <SeaLink href="/knowledge">
              走进知识书架 <ArrowRight size={15} />
            </SeaLink>
          </div>
          <div className="sea-topics">
            <SectionTitle title="沿着兴趣走走" />
            {["山地与自然", "宇宙与星空", "阅读与思考", "在路上的故事"].map((t, i) => (
              <SeaLink key={t} href={`/search?q=${encodeURIComponent(t)}`}>
                <span>0{i + 1}</span>
                {t}
                <ArrowRight size={14} />
              </SeaLink>
            ))}
          </div>
          <div className="sea-companion-card">
            <img src="/sea/whale.svg" alt="WhaleHall 原创鲸鱼桌宠插画" width="70" height="70" />
            <div>
              <strong>让陪伴，回到桌面</strong>
              <p>WhaleHall · 你的桌面伙伴</p>
              <SeaLink href="/companion">
                认识它 <ArrowRight size={13} />
              </SeaLink>
            </div>
          </div>
        </aside>
      </div>
      <section className="sea-shelf-preview">
        <SectionTitle
          eyebrow="KNOWLEDGE, GROWING TOGETHER"
          title="打开一本，也打开一个世界"
          link="全部知识模块"
          href="/knowledge"
        />
        {demo ? (
          <div className="sea-book-grid">
            {modules.map((m) => (
              <SeaLink key={m.id} href={`/knowledge/${m.id}`} className="sea-book-card">
                <div className="sea-book-art">
                  <img
                    src={`/sea/${m.image}.svg`}
                    alt={`${m.title}原创封面`}
                    width="340"
                    height="220"
                    loading="lazy"
                  />
                  <span className="sea-release">{m.release} 已发布 · 演示</span>
                </div>
                <div>
                  <span className="sea-eyebrow">{m.category}</span>
                  <h3>{m.title}</h3>
                  <p>{m.subtitle}</p>
                  <small>
                    {m.sources} 份原始资料 <span>·</span> {m.pages} 个知识页{" "}
                    <ArrowRight size={16} />
                  </small>
                </div>
              </SeaLink>
            ))}
          </div>
        ) : (
          <EmptyState title="知识书架等待接入">正式模块将来自独立的知识发布服务。</EmptyState>
        )}
      </section>
      <section className="sea-end-note">
        <span>✳</span>
        <h2>不急着抵达，先享受发现。</h2>
        <SeaLink href="/editor">
          记录今天的一个新发现 <Plus size={17} />
        </SeaLink>
      </section>
    </div>
  );
}
