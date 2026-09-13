"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import type { Story } from "../data/types";
import { ArrowRight, Bookmark, MessageCircle } from "./icons";
import { useSea } from "./SeaShell";
export function SeaLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const sea = useSea();
  const router = useRouter();
  const target = sea.href(href);
  return (
    <Link
      href={target}
      className={className}
      prefetch={false}
      onFocus={() => router.prefetch(target)}
      onPointerEnter={() => router.prefetch(target)}
    >
      {children}
    </Link>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  link,
  href,
}: {
  eyebrow?: string;
  title: string;
  link?: string;
  href?: string;
}) {
  return (
    <div className="sea-section-title">
      <div>
        {eyebrow && <span className="sea-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {link && href && (
        <SeaLink href={href} className="sea-text-link">
          {link}
          <ArrowRight size={15} />
        </SeaLink>
      )}
    </div>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`sea-notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      {children}
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="sea-empty">
      <div className="sea-empty-symbol">〰</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function StoryRow({
  story,
  rank,
  onFeedback,
}: {
  story: Story;
  rank?: number;
  onFeedback?: (id: string) => void;
}) {
  const { demo } = useSea();
  return (
    <article className="sea-story" data-story-id={story.id}>
      <div className="sea-story-copy">
        <div className="sea-meta">
          <span className="sea-mini-avatar">{story.author.slice(0, 1)}</span>
          <span>{story.author}</span>
          <span>·</span>
          <span>{story.topic}</span>
          {demo && rank !== undefined && (
            <span className="sea-reco-reason">与你的自然兴趣有关</span>
          )}
        </div>
        <SeaLink href={`/article/${story.id}`}>
          <h3>{story.title}</h3>
        </SeaLink>
        <p>{story.brief}</p>
        <div className="sea-story-footer">
          <span>{story.readTime || "阅读时长未知"}</span>
          <span>{story.likes === undefined ? "互动待加载" : `${story.likes} 赞同`}</span>
          <span>
            <MessageCircle size={13} />
            {story.comments ?? "—"}
          </span>
          {onFeedback && <button onClick={() => onFeedback(story.id)}>减少此类推荐</button>}
          <SeaLink className="sea-save" href={`/article/${story.id}`}>
            <Bookmark size={16} />
            <span className="sea-sr">阅读与收藏文章</span>
          </SeaLink>
        </div>
      </div>
      <SeaLink href={`/article/${story.id}`} className={`sea-story-image sea-art-${story.image}`}>
        <img
          src={`/sea/${story.image}.svg`}
          alt="原创自然主题插画"
          width="210"
          height="145"
          loading="lazy"
        />
      </SeaLink>
    </article>
  );
}
