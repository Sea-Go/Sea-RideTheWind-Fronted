import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";
import { memo } from "react";

import { InteractiveSurface } from "@/components/motion/InteractiveSurface";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card";
import type { DashboardPost } from "@/types";

interface CardProps extends DashboardPost {
  likeCount?: number;
  dislikeCount?: number;
  isLiked?: boolean;
  isDisliked?: boolean;
  isFavorited?: boolean;
  actionDisabled?: boolean;
  favoriteDisabled?: boolean;
  imagePriority?: boolean;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onFavorite?: (post: Pick<DashboardPost, "id" | "title" | "image">) => void;
  onOpen?: (id: string) => void;
  onPrefetch?: (id: string) => void;
}

const CARD_CONTROL_SELECTOR = "a,button,input,textarea,select,label,[data-card-open-ignore]";

const isCardControlTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && Boolean(target.closest(CARD_CONTROL_SELECTOR));

const formatScore = (value?: number | null, digits = 3): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value.toFixed(digits);
};

const formatPercent = (value?: number | null): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return `${(value * 100).toFixed(1)}%`;
};

export const Card = memo(function Card({
  id,
  title,
  image,
  author,
  likes,
  content,
  searchEvidence,
  likeCount = likes,
  dislikeCount = 0,
  isLiked = false,
  isDisliked = false,
  isFavorited = false,
  actionDisabled = false,
  favoriteDisabled = false,
  imagePriority = false,
  onLike,
  onDislike,
  onFavorite,
  onOpen,
  onPrefetch,
}: CardProps) {
  const canOpenDetail =
    !id.startsWith("article-") && !id.startsWith("art_") && !id.startsWith("chk_");
  const searchTags = searchEvidence?.tags?.filter(Boolean) ?? [];

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!canOpenDetail || isCardControlTarget(event.target)) {
      return;
    }

    onOpen?.(id);
  };

  const handlePrefetch = () => {
    if (!canOpenDetail) {
      return;
    }

    onPrefetch?.(id);
  };

  return (
    <InteractiveSurface
      asChild
      variant="card"
      onDoubleClick={handleDoubleClick}
      onFocus={handlePrefetch}
      onPointerEnter={handlePrefetch}
    >
      <UICard className="border-border bg-card/90 group gap-0 overflow-hidden rounded-[1.15rem] p-0 shadow-md shadow-black/5">
        {image && (
          <div className="relative h-52 w-full overflow-hidden sm:h-56">
            <Image
              src={image}
              alt={title}
              fill
              priority={imagePriority}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 420px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            />
          </div>
        )}
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h3 className="text-foreground line-clamp-2 text-base leading-tight font-bold">
            {canOpenDetail ? (
              <Link
                href={`/article/${encodeURIComponent(id)}`}
                className="hover:text-primary underline-offset-4 hover:underline"
              >
                {title}
              </Link>
            ) : (
              <span>{title}</span>
            )}
          </h3>
          <p className="text-muted-foreground line-clamp-2 min-h-9 text-sm leading-5">{content}</p>
          {searchEvidence ? (
            <div className="border-border bg-muted/55 space-y-3 rounded-2xl border p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-1 font-semibold">
                  命中证据
                </span>
                {searchEvidence.chunkId ? (
                  <span className="border-border bg-card/85 text-primary rounded-full border px-2 py-1 font-mono">
                    {searchEvidence.chunkId}
                  </span>
                ) : null}
                {searchEvidence.matchScore != null ? (
                  <span className="border-border bg-card/85 text-muted-foreground rounded-full border px-2 py-1">
                    匹配 {formatPercent(searchEvidence.matchScore)}
                  </span>
                ) : null}
                {searchEvidence.rerankScore != null ? (
                  <span className="border-border bg-card/85 text-muted-foreground rounded-full border px-2 py-1">
                    重排 {formatScore(searchEvidence.rerankScore, 1)}
                  </span>
                ) : null}
                {searchEvidence.vectorScore != null ? (
                  <span className="border-border bg-card/85 text-muted-foreground rounded-full border px-2 py-1">
                    向量 {formatScore(searchEvidence.vectorScore)}
                  </span>
                ) : null}
                {searchEvidence.articleScore != null ? (
                  <span className="border-border bg-card/85 text-muted-foreground rounded-full border px-2 py-1">
                    文章 {formatScore(searchEvidence.articleScore)}
                  </span>
                ) : null}
              </div>
              {searchEvidence.snippet ? (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Snippet
                  </p>
                  <p className="text-foreground line-clamp-5 text-xs leading-5">
                    {searchEvidence.snippet}
                  </p>
                </div>
              ) : null}
              {searchEvidence.typeTags || searchTags.length ? (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {searchEvidence.typeTags ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                      分类 {searchEvidence.typeTags}
                    </span>
                  ) : null}
                  {searchTags.map((tag) => (
                    <span
                      key={`${id}-evidence-tag-${tag}`}
                      className="border-border bg-card/80 text-muted-foreground rounded-full border px-2 py-1"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
            <span>{author}</span>
            <Button
              variant={isFavorited ? "default" : "outline"}
              size="sm"
              disabled={favoriteDisabled}
              onClick={() => onFavorite?.({ id, title, image })}
              className="border-border h-8 rounded-full px-3 text-xs"
            >
              {isFavorited ? "已收藏" : "收藏"}
            </Button>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
            <Button
              variant={isLiked ? "default" : "ghost"}
              size="sm"
              disabled={actionDisabled}
              onClick={() => onLike?.(id)}
              className="h-7 rounded-full px-2 text-xs"
            >
              赞 {likeCount}
            </Button>
            <Button
              variant={isDisliked ? "destructive" : "ghost"}
              size="sm"
              disabled={actionDisabled}
              onClick={() => onDislike?.(id)}
              className="h-7 rounded-full px-2 text-xs"
            >
              踩 {dislikeCount}
            </Button>
          </div>
        </CardContent>
      </UICard>
    </InteractiveSurface>
  );
});
