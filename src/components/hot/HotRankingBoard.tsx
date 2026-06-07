"use client";

import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  FlameIcon,
  HeartIcon,
  MessageCircleIcon,
  RefreshCcwIcon,
  SparklesIcon,
  TrendingUpIcon,
  TrophyIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { InteractiveSurface } from "@/components/motion/InteractiveSurface";
import { MotionList } from "@/components/motion/MotionList";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getHotArticles, type HotArticleItem, type HotArticlesResponse } from "@/services/hot";

const PAGE_SIZE = 20;
const EMPTY_HOT_ITEMS: HotArticleItem[] = [];
const numberFormatter = new Intl.NumberFormat("zh-CN");

interface HotRankingBoardProps {
  embedded?: boolean;
}

const formatMetric = (value?: number): string => {
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  if (safeValue >= 10000) {
    return `${(safeValue / 10000).toFixed(safeValue >= 100000 ? 0 : 1)}w`;
  }
  if (safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(safeValue >= 10000 ? 0 : 1)}k`;
  }
  return numberFormatter.format(Math.max(0, Math.round(safeValue)));
};

const formatCreateTime = (value?: number): string => {
  if (!value) {
    return "时间未知";
  }

  const timestamp = value > 1_000_000_000_000 ? value : value * 1000;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const collectTags = (item: HotArticleItem): string[] =>
  Array.from(new Set([item.manual_type_tag, ...(item.secondary_tags ?? [])].filter(Boolean))).slice(
    0,
    4,
  );

const resolveErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error) || !error.message) {
    return "热榜加载失败，请稍后重试";
  }

  return error.message === "internal server error" ? "热榜服务暂时不可用" : error.message;
};

const HotCover = ({
  item,
  className,
  priority = false,
  sizes,
}: {
  item: HotArticleItem;
  className?: string;
  priority?: boolean;
  sizes: string;
}) => (
  <div className={cn("app-media-frame relative overflow-hidden", className)}>
    {item.cover_image_url ? (
      <Image
        src={item.cover_image_url}
        alt={item.title || "热榜文章封面"}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-[#e11d48]">
        <SparklesIcon className="size-10" />
      </div>
    )}
  </div>
);

export const HotRankingBoard = ({ embedded = false }: HotRankingBoardProps) => {
  const [page, setPage] = useState(1);
  const [refreshNonce, setRefreshNonce] = useState(0);
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
          setErrorMessage(resolveErrorMessage(error));
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
  }, [page, refreshNonce]);

  const items = data?.items ?? EMPTY_HOT_ITEMS;
  const leadItem = items[0] ?? null;
  const staircaseItems = items.slice(1, 5);
  const rankedItems = items.slice(5);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const maxHotScore = useMemo(
    () => Math.max(1, ...items.map((item) => item.hot_score || 0)),
    [items],
  );

  const handleRefresh = () => {
    setRefreshNonce((current) => current + 1);
  };

  return (
    <section className={cn("space-y-5", embedded ? "pb-10" : "py-8")}>
      <section className="app-hero-surface relative overflow-hidden rounded-[1.25rem] p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_18%,transparent),transparent,color-mix(in_oklab,var(--destructive)_16%,transparent))]"
        />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
                <FlameIcon className="size-3.5" />
                实时热度
              </span>
              <span className="app-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                <TrendingUpIcon className="size-3.5" />
                全站前 100
              </span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">全站热榜</h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="app-pill rounded-full px-3 py-1.5">
                第 {page} / {totalPages} 页
              </span>
              <span className="app-pill rounded-full px-3 py-1.5">
                {formatMetric(data?.total)} 篇内容
              </span>
            </div>
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="rounded-full bg-[#e11d48] text-white shadow-lg shadow-rose-900/15 hover:bg-[#be123c]"
            >
              <RefreshCcwIcon className={cn("size-4", isLoading && "animate-spin")} />
              刷新热榜
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="app-surface h-[28rem] animate-pulse rounded-[1.15rem]" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`hot-stair-skeleton-${index}`}
                className="app-surface h-24 animate-pulse rounded-[1rem]"
              />
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <section className="app-danger-surface rounded-[1rem] p-8 text-center text-sm font-medium">
          {errorMessage}
        </section>
      ) : null}

      {!isLoading && !errorMessage && !items.length ? (
        <section className="app-empty-state rounded-[1rem] p-10 text-center text-sm">
          暂无热榜文章
        </section>
      ) : null}

      {!isLoading && !errorMessage && leadItem ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <InteractiveSurface asChild variant="card">
            <Link
              href={`/article/${encodeURIComponent(leadItem.article_id)}`}
              className="app-surface group relative min-h-[28rem] overflow-hidden rounded-[1.15rem]"
            >
              <HotCover
                item={leadItem}
                priority
                sizes="(max-width: 1280px) 100vw, 620px"
                className="absolute inset-0"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(31,41,55,0.04)_0%,rgba(31,41,55,0.18)_46%,rgba(31,41,55,0.62)_100%)]" />
              <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-[#e11d48] px-4 py-2 text-sm font-black text-white shadow-lg shadow-rose-950/20">
                <TrophyIcon className="size-4" />#{leadItem.rank}
              </div>
              <div className="app-surface-elevated absolute inset-x-3 bottom-3 rounded-[1rem] p-4 md:inset-x-4 md:bottom-4 md:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="app-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-[#be123c]">
                    <FlameIcon className="size-3.5" />
                    热度 {formatMetric(leadItem.hot_score)}
                  </span>
                  {collectTags(leadItem)
                    .slice(0, 3)
                    .map((tag) => (
                      <span
                        key={`lead-hot-tag-${tag}`}
                        className="app-pill rounded-full px-2.5 py-1 text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
                <h2 className="line-clamp-2 text-2xl leading-tight font-black sm:text-3xl">
                  {leadItem.title || "未命名文章"}
                </h2>
                {leadItem.brief ? (
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-6">
                    {leadItem.brief}
                  </p>
                ) : null}
                <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <EyeIcon className="size-3.5" />
                    {formatMetric(leadItem.view_count)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <HeartIcon className="size-3.5" />
                    {formatMetric(leadItem.like_count)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircleIcon className="size-3.5" />
                    {formatMetric(leadItem.comment_count)}
                  </span>
                </div>
              </div>
            </Link>
          </InteractiveSurface>

          <section className="app-surface rounded-[1.15rem] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-[#be123c] uppercase">
                  Sakura Heat
                </p>
                <h2 className="mt-1 text-lg font-black">樱花热度阶梯</h2>
              </div>
              <FlameIcon className="size-5 text-[#e11d48]" />
            </div>

            <MotionList className="space-y-3">
              {staircaseItems.map((item) => {
                const hotRatio = Math.max(8, Math.min(100, (item.hot_score / maxHotScore) * 100));

                return (
                  <InteractiveSurface asChild variant="card" key={item.article_id}>
                    <Link
                      href={`/article/${encodeURIComponent(item.article_id)}`}
                      className="app-surface-soft group grid gap-3 rounded-[0.9rem] p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)]"
                    >
                      <div className="app-warning-surface flex h-14 w-14 items-center justify-center rounded-[0.75rem] text-xl font-black text-[#be123c]">
                        {item.rank}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-sm leading-5 font-bold transition-colors group-hover:text-[#e11d48]">
                            {item.title || "未命名文章"}
                          </h3>
                          <span className="app-pill inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-[#e11d48]">
                            <FlameIcon className="size-3" />
                            {formatMetric(item.hot_score)}
                          </span>
                        </div>
                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#f9a8d4,#e11d48)]"
                            style={{ width: `${hotRatio}%` }}
                          />
                        </div>
                        <div className="text-muted-foreground flex flex-wrap gap-3 text-[11px] font-medium">
                          <span className="inline-flex items-center gap-1">
                            <EyeIcon className="size-3" />
                            {formatMetric(item.view_count)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <HeartIcon className="size-3" />
                            {formatMetric(item.like_count)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </InteractiveSurface>
                );
              })}
            </MotionList>
          </section>
        </div>
      ) : null}

      {!isLoading && !errorMessage && rankedItems.length > 0 ? (
        <section className="app-surface rounded-[1.15rem] p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#be123c] uppercase">
                Full Ranking
              </p>
              <h2 className="mt-1 text-xl font-black">完整榜单</h2>
            </div>
          </div>

          <MotionList className="space-y-3">
            {rankedItems.map((item) => {
              const tags = collectTags(item);

              return (
                <InteractiveSurface
                  variant="card"
                  key={item.article_id}
                  className="app-surface-soft hover:border-primary/40 grid gap-3 rounded-[0.95rem] p-3 transition-colors sm:grid-cols-[4rem_7.5rem_minmax(0,1fr)] lg:grid-cols-[4.5rem_9rem_minmax(0,1fr)_auto]"
                >
                  <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:justify-center">
                    <div className="text-2xl font-black tracking-tight text-[#be123c]">
                      #{item.rank}
                    </div>
                    <div className="app-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-[#e11d48]">
                      <FlameIcon className="size-3.5" />
                      {formatMetric(item.hot_score)}
                    </div>
                  </div>

                  <HotCover
                    item={item}
                    sizes="(max-width: 640px) 100vw, 160px"
                    className="h-32 rounded-[0.8rem] sm:h-full sm:min-h-28"
                  />

                  <div className="min-w-0 space-y-2">
                    <Link
                      href={`/article/${encodeURIComponent(item.article_id)}`}
                      className="line-clamp-2 text-base leading-6 font-black transition-colors hover:text-[#e11d48]"
                    >
                      {item.title || "未命名文章"}
                    </Link>
                    {item.brief ? (
                      <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
                        {item.brief}
                      </p>
                    ) : null}
                    {tags.length ? (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={`${item.article_id}-tag-${tag}`}
                            className="app-pill rounded-full px-2.5 py-1 text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="text-muted-foreground flex flex-wrap gap-4 text-xs font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <EyeIcon className="size-3.5" />
                        {formatMetric(item.view_count)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <HeartIcon className="size-3.5" />
                        {formatMetric(item.like_count)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MessageCircleIcon className="size-3.5" />
                        {formatMetric(item.comment_count)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="size-3.5" />
                        {formatCreateTime(item.create_time)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center lg:justify-end">
                    <Button asChild variant="outline" className="w-full rounded-full lg:w-auto">
                      <Link href={`/article/${encodeURIComponent(item.article_id)}`}>
                        查看文章
                        <ArrowRightIcon className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </InteractiveSurface>
              );
            })}
          </MotionList>
        </section>
      ) : null}

      <div className="app-surface flex flex-col gap-3 rounded-[1rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-bold">榜单分页</p>
          <p className="text-muted-foreground text-xs">
            当前第 {page} 页，共 {totalPages} 页
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-full"
          >
            <ChevronLeftIcon className="size-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-full"
          >
            下一页
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};
