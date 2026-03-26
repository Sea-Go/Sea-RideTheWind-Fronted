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

export const Card = ({
  id,
  title,
  image,
  author,
  likes,
  content,
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
