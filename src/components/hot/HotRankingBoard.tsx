"use client";

import { EyeIcon, FlameIcon, HeartIcon, MessageCircleIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getHotArticles, type HotArticleItem, type HotArticlesResponse } from "@/services/hot";

const PAGE_SIZE = 20;

const FEATURED_CARD_STYLES = [
  "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-red-50",
  "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-zinc-50",
  "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50",
] as const;

const FEATURED_BADGE_STYLES = [
  "bg-orange-500 text-white",
  "bg-slate-700 text-white",
  "bg-amber-500 text-white",
] as const;

const numberFormatter = new Intl.NumberFormat("zh-CN");

interface HotRankingBoardProps {
  embedded?: boolean;
}

const formatMetric = (value: number | undefined): string => numberFormatter.format(value ?? 0);

const formatCreateTime = (value: number | undefined): string => {
  if (!value) {
    return "时间未知";
  }

  const timestamp = value > 1_000_000_000_000 ? value : value * 1000;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const renderCover = (item: HotArticleItem, compact = false) => {
  if (item.cover_image_url) {
    return (
      <img
        src={item.cover_image_url}
        alt={item.title || "热榜文章封面"}
        className={cn("w-full rounded-2xl object-cover", compact ? "h-28 sm:h-32" : "h-44")}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 via-amber-50 to-rose-100 text-sm font-medium text-orange-700",
        compact ? "h-28 sm:h-32" : "h-44",
      )}
    >
      暂无封面
    </div>
  );
};

export const HotRankingBoard = ({ embedded = false }: HotRankingBoardProps) => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HotArticlesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getHotArticles({ page, page_size: PAGE_SIZE });
        if (!cancelled) {
          setData(response);
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setErrorMessage(error instanceof Error ? error.message : "热榜加载失败");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const items = data?.items ?? [];
  const featuredItems = items.slice(0, 3);
  const rankedItems = items.slice(3);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <section className={cn("space-y-6", embedded ? "pb-10" : "py-8")}>
      <Card className="overflow-hidden border-none bg-gradient-to-br from-orange-500 via-rose-500 to-red-500 text-white shadow-xl">
        <CardHeader className="gap-3 px-6 py-7 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase">
              <FlameIcon className="h-3.5 w-3.5" />
              滚动热榜前一百
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs">滚动热榜</span>
          </div>
          <CardTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
            全站热榜
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-6 text-orange-50 sm:text-base">
            当前滚动热榜会按实时热度动态变化。榜单范围固定覆盖全站前一百，本页每次展示二十篇。
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center gap-3 px-6 pb-7 text-sm text-orange-50 sm:px-8">
          <span>第 {page} 页</span>
          <span>共 {totalPages} 页</span>
          <span>累计 {formatMetric(data?.total)} 篇有效文章</span>
        </CardFooter>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            热榜加载中...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card className="border-red-200">
          <CardContent className="py-12 text-center text-sm text-red-600">
            {errorMessage}
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            当前没有可展示的热榜文章。
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !errorMessage && featuredItems.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {featuredItems.map((item, index) => (
            <Card
              key={item.article_id}
              className={cn("overflow-hidden border shadow-lg", FEATURED_CARD_STYLES[index])}
            >
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                      FEATURED_BADGE_STYLES[index],
                    )}
                  >
                    <TrophyIcon className="h-3.5 w-3.5" />第 {item.rank} 名
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-slate-700">
                    <FlameIcon className="h-3.5 w-3.5 text-orange-500" />
                    {formatMetric(item.hot_score)}
                  </span>
                </div>
                {renderCover(item)}
                <div className="space-y-2">
                  <CardTitle className="line-clamp-2 text-xl leading-7">
                    {item.title || "未命名文章"}
                  </CardTitle>
                  <CardDescription className="line-clamp-3 text-sm leading-6 text-slate-600">
                    {item.brief || "这篇文章暂时没有摘要，点击可查看完整内容。"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {item.secondary_tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-white/70 px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <EyeIcon className="h-3.5 w-3.5" />
                    {formatMetric(item.view_count)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <HeartIcon className="h-3.5 w-3.5" />
                    {formatMetric(item.like_count)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircleIcon className="h-3.5 w-3.5" />
                    {formatMetric(item.comment_count)}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">{formatCreateTime(item.create_time)}</span>
                <Button asChild size="sm">
                  <Link href={`/article/${encodeURIComponent(item.article_id)}`}>查看文章</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : null}

      {!isLoading && !errorMessage && rankedItems.length > 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">完整排名</CardTitle>
            <CardDescription>按当前滚动热度排序，保留后端返回的榜单原始顺序。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rankedItems.map((item) => (
              <div
                key={item.article_id}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-orange-200 hover:bg-orange-50/40 lg:grid-cols-[88px_minmax(0,180px)_1fr_auto]"
              >
                <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                  <div className="text-3xl font-semibold tracking-tight text-slate-900">
                    #{item.rank}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                    <FlameIcon className="h-3.5 w-3.5" />
                    {formatMetric(item.hot_score)}
                  </div>
                </div>

                <div className="overflow-hidden">{renderCover(item, true)}</div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Link
                      href={`/article/${encodeURIComponent(item.article_id)}`}
                      className="line-clamp-2 text-lg font-semibold text-slate-900 hover:text-orange-600"
                    >
                      {item.title || "未命名文章"}
                    </Link>
                    <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                      {item.brief || "这篇文章暂时没有摘要，点击可查看完整内容。"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    {item.secondary_tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 px-3 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <EyeIcon className="h-3.5 w-3.5" />
                      {formatMetric(item.view_count)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <HeartIcon className="h-3.5 w-3.5" />
                      {formatMetric(item.like_count)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircleIcon className="h-3.5 w-3.5" />
                      {formatMetric(item.comment_count)}
                    </span>
                    <span>{formatCreateTime(item.create_time)}</span>
                  </div>
                </div>

                <div className="flex items-center lg:justify-end">
                  <Button asChild variant="outline">
                    <Link href={`/article/${encodeURIComponent(item.article_id)}`}>查看文章</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900">榜单分页</p>
          <p className="text-xs text-slate-500">
            当前第 {page} 页，共 {totalPages} 页
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((current) => current + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </section>
  );
};
