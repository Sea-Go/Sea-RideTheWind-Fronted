import Image from "next/image";
import Link from "next/link";

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
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onFavorite?: (post: Pick<DashboardPost, "id" | "title" | "image">) => void;
}

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

export const Card = ({
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
  onLike,
  onDislike,
  onFavorite,
}: CardProps) => {
  const canOpenDetail =
    !id.startsWith("article-") && !id.startsWith("art_") && !id.startsWith("chk_");
  const searchTags = searchEvidence?.tags?.filter(Boolean) ?? [];

  return (
    <UICard className="gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md">
      {image && (
        <div className="relative h-64 w-full">
          <Image
            src={image}
            alt={title}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 320px"
            className="rounded-t-lg object-cover"
          />
        </div>
      )}
      <CardContent className="space-y-3 p-4">
        <h3 className="text-foreground line-clamp-2 text-sm leading-tight font-semibold">
          {canOpenDetail ? (
            <Link href={`/article/${encodeURIComponent(id)}`} className="hover:underline">
              {title}
            </Link>
          ) : (
            <span>{title}</span>
          )}
        </h3>
        <p className="text-muted-foreground line-clamp-2 text-xs">{content}</p>
        {searchEvidence ? (
          <div className="space-y-3 rounded-2xl border border-sky-200/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.96),rgba(248,250,252,0.94))] p-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-sky-600 px-2 py-1 font-semibold text-white">
                命中证据
              </span>
              {searchEvidence.chunkId ? (
                <span className="rounded-full border border-sky-200 bg-white/85 px-2 py-1 font-mono text-sky-700">
                  {searchEvidence.chunkId}
                </span>
              ) : null}
              {searchEvidence.matchScore != null ? (
                <span className="rounded-full border border-sky-200 bg-white/85 px-2 py-1 text-slate-600">
                  匹配 {formatPercent(searchEvidence.matchScore)}
                </span>
              ) : null}
              {searchEvidence.rerankScore != null ? (
                <span className="rounded-full border border-sky-200 bg-white/85 px-2 py-1 text-slate-600">
                  重排 {formatScore(searchEvidence.rerankScore, 1)}
                </span>
              ) : null}
              {searchEvidence.vectorScore != null ? (
                <span className="rounded-full border border-sky-200 bg-white/85 px-2 py-1 text-slate-600">
                  向量 {formatScore(searchEvidence.vectorScore)}
                </span>
              ) : null}
              {searchEvidence.articleScore != null ? (
                <span className="rounded-full border border-sky-200 bg-white/85 px-2 py-1 text-slate-600">
                  文章 {formatScore(searchEvidence.articleScore)}
                </span>
              ) : null}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Snippet
              </p>
              <p className="line-clamp-5 text-xs leading-5 text-slate-700">
                {searchEvidence.snippet || "后端这次没有返回具体片段文本。"}
              </p>
            </div>
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
                    className="rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>{author}</span>
          <Button
            variant={isFavorited ? "default" : "outline"}
            size="sm"
            disabled={favoriteDisabled}
            onClick={() => onFavorite?.({ id, title, image })}
            className="h-7 rounded-full px-3 text-xs"
          >
            {isFavorited ? "已收藏" : "收藏"}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs">
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
  );
};
