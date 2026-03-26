"use client";

import { Viewer } from "@bytemd/react";

interface MarkdownArticleProps {
  value: string;
  emptyText?: string;
}

export const MarkdownArticle = ({
  value,
  emptyText = "暂无正文",
}: MarkdownArticleProps) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return <p className="text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="article-markdown">
      <Viewer value={normalizedValue} />
    </div>
  );
};
