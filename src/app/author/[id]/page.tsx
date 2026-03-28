"use client";

import { ArrowLeftIcon, BookOpenTextIcon, RefreshCcwIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { type ArticleItem, listArticles } from "@/services/article";
import { getAuthToken, getUserProfile } from "@/services/auth";
import { followUser, getFollowList, unfollowUser } from "@/services/follow";

const PAGE_SIZE = 12;
const PUBLISHED_STATUS = 2;
const FOLLOW_STATE_PAGE_SIZE = 200;
const FOLLOW_STATE_MAX_PAGES = 10;

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

const normalizeUserIds = (items: unknown[]): string[] =>
  items.map((item) => normalizeId(item)).filter(Boolean);

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
    return "暂时还没有摘要，打开文章可以查看更多内容。";
  }

  return content.length > 88 ? `${content.slice(0, 88)}...` : content;
};

const formatTime = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("zh-CN", { hour12: false });
    }
  }

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const authorId = useMemo(() => decodeURIComponent(params.id), [params.id]);
  const authorNameHint = useMemo(() => {
    const value = searchParams.get("name");
    return value && value.trim() ? value.trim() : "";
  }, [searchParams]);
  const authorSpaceHref = useMemo(() => {
    if (!authorId) {
      return "/author";
    }
    const query = authorNameHint ? `?name=${encodeURIComponent(authorNameHint)}` : "";
    return `/author/${encodeURIComponent(authorId)}${query}`;
  }, [authorId, authorNameHint]);

  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isFollowStateLoading, setIsFollowStateLoading] = useState(true);
  const [isFollowActionLoading, setIsFollowActionLoading] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followMessage, setFollowMessage] = useState<string | null>(null);
  const [followMessageIsError, setFollowMessageIsError] = useState(false);
  const [resolvedAuthorName, setResolvedAuthorName] = useState(
    authorNameHint || (authorId ? `作者 ${authorId}` : "作者空间"),
  );

  useEffect(() => {
    setResolvedAuthorName(authorNameHint || (authorId ? `作者 ${authorId}` : "作者空间"));
  }, [authorId, authorNameHint]);

  useEffect(() => {
    setPage(1);
  }, [authorId]);

  const loadFollowState = useCallback(
    async (currentToken: string, viewerId: string, targetAuthorId: string): Promise<boolean> => {
      let offset = 0;

      for (let pageIndex = 0; pageIndex < FOLLOW_STATE_MAX_PAGES; pageIndex += 1) {
        const response = await getFollowList(currentToken, {
          user_id: viewerId,
          offset,
          limit: FOLLOW_STATE_PAGE_SIZE,
        });
        const followIds = normalizeUserIds(
          Array.isArray(response.user_ids) ? response.user_ids : [],
        );

        if (followIds.includes(targetAuthorId)) {
          return true;
        }
        if (followIds.length < FOLLOW_STATE_PAGE_SIZE) {
          return false;
        }

        offset += FOLLOW_STATE_PAGE_SIZE;
      }

      return false;
    },
    [],
  );

  useEffect(() => {
    const currentToken = getAuthToken();
    setToken(currentToken);
    setCurrentUserId("");
    setIsFollowed(false);
    setFollowMessage(null);
    setFollowMessageIsError(false);

    if (!currentToken || !authorId) {
      setIsFollowStateLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsFollowStateLoading(true);

      try {
        const profile = await getUserProfile(currentToken);
        const viewerId = normalizeId(profile.user.uid);
        if (cancelled) {
          return;
        }

        setCurrentUserId(viewerId);
        if (!viewerId || viewerId === authorId) {
          setIsFollowed(false);
          return;
        }

        const followed = await loadFollowState(currentToken, viewerId, authorId);
        if (cancelled) {
          return;
        }

        setIsFollowed(followed);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn("Failed to load author follow state:", error);
        setFollowMessage("关注状态加载失败，但不影响查看作者页。");
        setFollowMessageIsError(true);
      } finally {
        if (!cancelled) {
          setIsFollowStateLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorId, loadFollowState]);

  const loadArticles = useCallback(
    async (nextPage: number) => {
      if (!authorId) {
        setArticles([]);
        setTotal(0);
        setErrorMessage("缺少作者标识，暂时无法加载文章。");
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
        setErrorMessage(error instanceof Error ? error.message : "作者文章加载失败，请稍后重试。");
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

  const isOwnAuthorSpace = !!currentUserId && currentUserId === authorId;

  const handleFollowAction = useCallback(async () => {
    if (!authorId) {
      return;
    }

    if (!token) {
      router.push(`/login?next=${encodeURIComponent(authorSpaceHref)}`);
      return;
    }

    if (isOwnAuthorSpace || isFollowActionLoading) {
      return;
    }

    setIsFollowActionLoading(true);
    setFollowMessage(null);
    setFollowMessageIsError(false);

    try {
      if (isFollowed) {
        await unfollowUser(token, { target_id: authorId });
        setIsFollowed(false);
        setFollowMessage("已取消关注这位作者。");
      } else {
        await followUser(token, { target_id: authorId });
        setIsFollowed(true);
        setFollowMessage("关注成功，之后可以更快看到这位作者的更新。");
      }
    } catch (error) {
      setFollowMessage(error instanceof Error ? error.message : "关注操作失败，请稍后重试。");
      setFollowMessageIsError(true);
    } finally {
      setIsFollowActionLoading(false);
    }
  }, [
    authorId,
    authorSpaceHref,
    isFollowActionLoading,
    isFollowed,
    isOwnAuthorSpace,
    router,
    token,
  ]);

  const followButtonLabel = (() => {
    if (!authorId) {
      return "无法关注";
    }
    if (!token) {
      return "登录后关注";
    }
    if (isOwnAuthorSpace) {
      return "这是你自己";
    }
    if (isFollowActionLoading) {
      return "处理中...";
    }
    if (isFollowStateLoading) {
      return "加载关注状态...";
    }
    return isFollowed ? "取消关注" : "关注作者";
  })();

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
                  这里展示这位作者最近发布的内容，你可以快速浏览主题方向，也可以直接进入文章详情继续阅读。
                </p>
                <p className="text-muted-foreground text-xs">作者 ID：{authorId || "--"}</p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="outline">
                  <Link href="/dashboard/recommend">
                    <ArrowLeftIcon className="size-4" />
                    返回推荐页
                  </Link>
                </Button>
                <Button
                  variant={isFollowed && token ? "secondary" : "default"}
                  onClick={() => void handleFollowAction()}
                  disabled={
                    !authorId || isOwnAuthorSpace || isFollowStateLoading || isFollowActionLoading
                  }
                >
                  {followButtonLabel}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void loadArticles(page)}
                  disabled={isLoading}
                >
                  <RefreshCcwIcon className={isLoading ? "size-4 animate-spin" : "size-4"} />
                  {isLoading ? "刷新中..." : "刷新文章"}
                </Button>
              </div>
              {followMessage && (
                <p
                  className={`text-sm ${followMessageIsError ? "text-destructive" : "text-emerald-700"}`}
                >
                  {followMessage}
                </p>
              )}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl border bg-white/80 p-5 shadow-sm">
            <p className="text-muted-foreground text-sm">当前展示</p>
            <p className="mt-2 text-3xl font-bold">{articles.length}</p>
            <p className="text-muted-foreground mt-2 text-xs">本页已发布文章数量</p>
          </div>
          <div className="rounded-3xl border bg-white/80 p-5 shadow-sm">
            <p className="text-muted-foreground text-sm">页码位置</p>
            <p className="mt-2 text-3xl font-bold">
              {page} / {totalPages}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">支持翻页查看更多作者内容</p>
          </div>
          <div className="rounded-3xl border bg-white/80 p-5 shadow-sm">
            <p className="text-muted-foreground text-sm">作者标识</p>
            <p className="mt-2 text-lg font-semibold break-all">{authorId || "--"}</p>
            <p className="text-muted-foreground mt-2 text-xs">便于排查文章归属与跳转问题</p>
          </div>
        </section>

        {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={`author-article-skeleton-${index}`}
                className="overflow-hidden rounded-lg border bg-white/80 shadow-sm"
              >
                <div className="bg-muted h-40 animate-pulse" />
                <div className="space-y-3 p-3">
                  <div className="bg-muted h-4 w-24 animate-pulse rounded-full" />
                  <div className="bg-muted h-4 w-5/6 animate-pulse rounded" />
                  <div className="bg-muted h-3 w-full animate-pulse rounded" />
                  <div className="bg-muted h-3 w-4/5 animate-pulse rounded" />
                  <div className="flex gap-2">
                    <div className="bg-muted h-5 w-12 animate-pulse rounded-full" />
                    <div className="bg-muted h-5 w-12 animate-pulse rounded-full" />
                  </div>
                  <div className="bg-muted h-8 w-20 animate-pulse rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed p-10 text-center">
            <p className="text-lg font-semibold">这位作者暂时还没有可展示的文章。</p>
            <p className="text-muted-foreground mt-2 text-sm">
              你可以稍后再来看，或者先回到推荐页继续浏览其他内容。
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
                卡片尺寸已经按推荐页的密度收紧，方便一屏内浏览更多文章。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
                    className="overflow-hidden rounded-lg border bg-white/85 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {cover && (
                      <div className="relative h-40 w-full overflow-hidden">
                        <Image
                          src={cover}
                          alt={title}
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 100vw, 320px"
                          className="object-cover"
                        />
                      </div>
                    )}

                    <div className="space-y-2.5 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-1">
                          发布于 {formatTime(article.create_time)}
                        </span>
                      </div>

                      <h2 className="line-clamp-2 text-sm leading-5 font-semibold">{title}</h2>

                      <p className="text-muted-foreground line-clamp-2 text-xs leading-5">
                        {summary}
                      </p>

                      {secondaryTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {secondaryTags.slice(0, 2).map((tag) => (
                            <span
                              key={`${articleId}-${tag}`}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">
                          浏览 {toNumber(article.view_count, 0)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">
                          点赞 {toNumber(article.like_count ?? article.likes, 0)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">
                          评论 {toNumber(article.comment_count, 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-end">
                        {articleId && (
                          <Button asChild size="sm" className="h-8 rounded-full px-4 text-xs">
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
