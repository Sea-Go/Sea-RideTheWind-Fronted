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
  actionDisabled?: boolean;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
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
  actionDisabled = false,
  onLike,
  onDislike,
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
      <CardContent className="space-y-2 p-4">
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
          <div className="flex items-center gap-1">
            <Button
              variant={isLiked ? "default" : "ghost"}
              size="sm"
              disabled={actionDisabled}
              onClick={() => onLike?.(id)}
              className="h-7 rounded-full px-2 text-xs"
            >
              👍 {likeCount}
            </Button>
            <Button
              variant={isDisliked ? "destructive" : "ghost"}
              size="sm"
              disabled={actionDisabled}
              onClick={() => onDislike?.(id)}
              className="h-7 rounded-full px-2 text-xs"
            >
              👎 {dislikeCount}
            </Button>
          </div>
        </div>
      </CardContent>
    </UICard>
  );
};
