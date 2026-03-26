"use client";

import { ArrowLeftIcon, BookOpenTextIcon, RefreshCcwIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { type ArticleItem, listArticles } from "@/services/article";

const PAGE_SIZE = 12;
const PUBLISHED_STATUS = 2;

const pickArticles = (payload: {
  articles?: ArticleItem[];
  list?: ArticleItem[];
  items?: ArticleItem[];
  records?: ArticleItem[];
}): ArticleItem[] => {
  if (Array.isArray(payload.articles)) {
    return payload.articles;
  }
  if (Array.isArray(payload.list)) {
    return payload.list;
  }
  if (Array.isArray(payload.items)) {
    return payload.items;
  }
  if (Array.isArray(payload.records)) {
    return payload.records;
  }
  return [];
};

const normalizeId = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
};

const toText = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const stripMarkdown = (value: string): string =>
  value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[[^\]]+]\(([^)]+)\)/g, "$1")
    .replace(/[`#>*_~\-]+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildSummary = (article: ArticleItem): string => {
  const brief = toText(article.brief);
  if (brief) {
    return brief;
  }

  const content = stripMarkdown(toText(article.content));
  if (!content) {
    return "这位作者暂时还没有留下摘要。";
  }

  return content.length > 140 ? `${content.slice(0, 140)}...` : content;
};

const formatTime = (value: unknown): string => {
  const timestamp = toNumber(value, 0);
  if (!timestamp) {
    return "--";
  }

  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
  });
};

export default function AuthorSpacePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const authorId = useMemo(() => decodeURIComponent(params.id), [params.id]);
  const authorNameHint = useMemo(() => {
    const value = searchParams.get("name");
    return value && value.trim() ? value.trim() : "";
  }, [searchParams]);

  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedAuthorName, setResolvedAuthorName] = useState(
    authorNameHint || (authorId ? `用户 ${authorId}` : "作者"),
  );

  useEffect(() => {
    setResolvedAuthorName(authorNameHint || (authorId ? `用户 ${authorId}` : "作者"));
  }, [authorId, authorNameHint]);

  const loadArticles = useCallback(
    async (nextPage: number) => {
      if (!authorId) {
        setArticles([]);
        setTotal(0);
        setErrorMessage("作者编号无效");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await listArticles({
          author_id: authorId,
          page: nextPage,
          page_size: PAGE_SIZE,
          sort_by: "create_time",
          desc: true,
        });

        const nextArticles = pickArticles(response).filter(
          (article) => toNumber(article.status, 0) === PUBLISHED_STATUS,
        );
        const nextAuthorName = nextArticles
          .map((article) => toText(article.author_name ?? article.username))
          .find(Boolean);

        setArticles(nextArticles);
        setPage(toNumber(response.page, nextPage) || nextPage);
        setTotal(toNumber(response.total, 0));
        if (nextAuthorName) {
          setResolvedAuthorName(nextAuthorName);
        }
      } catch (error) {
        setArticles([]);
        setTotal(0);
        setErrorMessage(error instanceof Error ? error.message : "作者文章加载失败，请稍后重试");
      } finally {
        setIsLoading(false);
      }
    },
    [authorId],
  );

  useEffect(() => {
    void loadArticles(page);
  }, [loadArticles, page]);

  const totalPages = useMemo(() => {
    if (total <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  const authorInitial = useMemo(() => {
    const source = resolvedAuthorName.trim() || "作";
    return source.slice(0, 1).toUpperCase();
  }, [resolvedAuthorName]);

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="rounded-[2rem] border border-sky-100 bg-[radial-gradient(circle_at_top_left,rgba(186,230,253,0.4),transparent_32%),linear-gradient(135deg,rgba(248,250,252,0.98),rgba(239,246,255,0.95))] p-6 shadow-sm shadow-sky-100/70">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-16 items-center justify-center rounded-[1.5rem] bg-sky-600 text-2xl font-semibold text-white shadow-lg shadow-sky-200">
                {authorInitial}
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm">
                  <BookOpenTextIcon className="size-3.5" />
                  作者空间
                </div>
                <h1 className="text-3xl font-bold tracking-tight">{resolvedAuthorName}</h1>
                <p className="text-muted-foreground text-sm">
                  在这里查看这位作者最近发布的文章，继续顺着作者的思路往下读。
                </p>
                <p className="text-muted-foreground text-xs">作者 ID：{authorId || "--"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline">
                <Link href="/dashboard/recommend">
                  <ArrowLeftIcon className="size-4" />
                  返回推荐页
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => void loadArticles(page)}
                disabled={isLoading}
              >
                <RefreshCcwIcon className={isLoading ? "size-4 animate-spin" : "size-4"} />
                {isLoading ? "加载中..." : "刷新作者文章"}
              </Button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-white/80 p-5 shadow-sm">
            <p className="text-muted-foreground text-sm">当前展示</p>
            <p className="mt-2 text-3xl font-bold">{articles.length}</p>
            <p className="text-muted-foreground mt-2 text-xs">本页已发布文章</p>
          </div>
          <div className="rounded-3xl border bg-white/80 p-5 shadow-sm">
            <p className="text-muted-foreground text-sm">页码位置</p>
            <p className="mt-2 text-3xl font-bold">
              {page} / {totalPages}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">按创建时间倒序排列</p>
          </div>
          <div className="rounded-3xl border bg-white/80 p-5 shadow-sm">
            <p className="text-muted-foreground text-sm">作者标识</p>
            <p className="mt-2 text-lg font-semibold break-all">{authorId || "--"}</p>
            <p className="text-muted-foreground mt-2 text-xs">文章会按作者编号聚合</p>
          </div>
        </section>

        {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`author-article-skeleton-${index}`} className="rounded-3xl border p-5">
                <div className="bg-muted h-5 w-40 animate-pulse rounded" />
                <div className="bg-muted mt-4 h-4 w-full animate-pulse rounded" />
                <div className="bg-muted mt-2 h-4 w-4/5 animate-pulse rounded" />
                <div className="bg-muted mt-6 h-9 w-32 animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed p-10 text-center">
            <p className="text-lg font-semibold">这位作者暂时还没有已发布文章</p>
            <p className="text-muted-foreground mt-2 text-sm">
              你可以稍后再来看看，或者先回到推荐页继续浏览其他内容。
            </p>
            <div className="mt-5">
              <Button asChild>
                <Link href="/dashboard/recommend">回到推荐页</Link>
              </Button>
            </div>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">作者相关文章</h2>
              <p className="text-muted-foreground text-sm">
                点开任意一篇文章，就能继续沿着这位作者的内容阅读。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {articles.map((article) => {
                const articleId = normalizeId(article.id ?? article.article_id);
                const title = toText(article.title, "未命名文章");
                const cover = toText(article.cover_image_url ?? article.cover);
                const summary = buildSummary(article);
                const secondaryTags = Array.isArray(article.secondary_tags)
                  ? article.secondary_tags.filter(
                      (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
                    )
                  : [];

                return (
                  <article
                    key={articleId || title}
                    className="overflow-hidden rounded-[2rem] border bg-white/80 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {cover && (
                      <div className="relative h-56 w-full overflow-hidden border-b">
                        <Image
                          src={cover}
                          alt={title}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="(max-width: 1280px) 100vw, 50vw"
                        />
                      </div>
                    )}

                    <div className="space-y-4 p-6">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>发布时间：{formatTime(article.create_time)}</span>
                        </div>
                        <h2 className="text-xl leading-snug font-semibold">{title}</h2>
                      </div>

                      <p className="text-muted-foreground line-clamp-4 text-sm leading-7">
                        {summary}
                      </p>

                      {secondaryTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {secondaryTags.slice(0, 6).map((tag) => (
                            <span
                              key={`${articleId}-${tag}`}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 text-sm text-slate-600">
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="text-xs text-slate-500">浏览</p>
                          <p className="mt-1 font-semibold">{toNumber(article.view_count, 0)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="text-xs text-slate-500">点赞</p>
                          <p className="mt-1 font-semibold">
                            {toNumber(article.like_count ?? article.likes, 0)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="text-xs text-slate-500">评论</p>
                          <p className="mt-1 font-semibold">{toNumber(article.comment_count, 0)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-muted-foreground text-xs">
                          文章 ID：{articleId || "--"}
                        </p>
                        {articleId && (
                          <Button asChild>
                            <Link href={`/article/${encodeURIComponent(articleId)}`}>进入文章</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-white/80 p-4 shadow-sm">
            <p className="text-muted-foreground text-sm">
              第 {page} 页，共 {totalPages} 页
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
}
