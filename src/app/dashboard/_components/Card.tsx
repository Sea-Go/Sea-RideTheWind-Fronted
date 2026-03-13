// Dashboard 文章卡片，统一为 shadcn Card 样式。
import Image from "next/image";

import { Card as UICard, CardContent } from "@/components/ui/card";
import type { DashboardPost } from "@/types";

type CardProps = Omit<DashboardPost, "id" | "publishedAt">;

export const Card = ({ title, image, author, likes, content }: CardProps) => {
  return (
    <UICard className="gap-0 overflow-hidden p-0">
      {image && (
        <div className="relative h-64 w-full">
          <Image
            src={image}
            alt={title}
            fill
            style={{ objectFit: "cover" }}
            className="rounded-t-lg"
          />
        </div>
      )}
      <CardContent className="space-y-2 p-4">
        <h3 className="text-foreground text-sm leading-tight font-semibold">{title}</h3>
        <p className="text-muted-foreground line-clamp-2 text-xs">{content}</p>
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>{author}</span>
          <span className="flex items-center">
            <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.253A8.014 8.014 0 0117.747 8H12V2.253z" />
            </svg>
            {likes}
          </span>
        </div>
      </CardContent>
    </UICard>
  );
};
