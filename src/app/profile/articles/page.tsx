"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileTextIcon, PenBoxIcon, RefreshCcwIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { Button } from "@/components/ui/button";
import { type ArticleItem, deleteArticle, listArticles } from "@/services/article";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  getFrontendAccessState,
  getUserProfile,
} from "@/services/auth";

const PAGE_SIZE = 12;

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

const formatTime = (value: unknown): string => {
  const timestamp = toNumber(value, 0);
  if (!timestamp) {
    return "--";
  }

  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
  });
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
    return "暂无摘要";
  }

  return content.length > 120 ? `${content.slice(0, 120)}...` : content;
};

const ARTICLE_STATUS_MAP: Record<number, { label: string; className: string }> = {
  1: {
    label: "草稿",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  2: {
    label: "已发布",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  3: {
    label: "审核中",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  4: {
    label: "已拒绝",
    className: "bg-rose-100 text-rose-700 border-rose-200",
  },
  5: {
    label: "已删除",
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  },
};

const getStatusMeta = (status: unknown) =>
  ARTICLE_STATUS_MAP[toNumber(status, 0)] ?? {
    label: "未知状态",
    className: "bg-muted text-muted-foreground border-border",
  };

const getArticleExtInfo = (article: ArticleItem): Record<string, string> => {
  const value = article.ext_info;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "string" && rawValue.trim()) {
      normalized[key] = rawValue.trim();
    }
  }
  return normalized;
};

const resolveArticleStatus = (
  article: ArticleItem,
): {
  label: string;
  className: string;
  detailTitle?: string;
  detailMessage?: string;
  detailHint?: string;
} => {
  const extInfo = getArticleExtInfo(article);
  const publishStage = toText(extInfo.publish_stage);
  const syncState = toText(extInfo.reco_sync_state);
  const rawError = toText(extInfo.last_sync_error);

  if (syncState === "failed" || publishStage.endsWith("failed")) {
    let detailMessage = rawError || "文章在入库阶段失败，请稍后重试。";
    if (detailMessage.startsWith("doc ingest failed:")) {
      detailMessage = detailMessage.replace(/^doc ingest failed:\s*/i, "");
    }
    if (detailMessage.includes("未找到一级标题")) {
      detailMessage =
        "系统在入库时没有从正文里识别到一级标题。现在标题会自动使用你发布时填写的标题，编辑后重新保存一次即可重新提交。";
    }

    return {
      label: "发布失败",
      className: "bg-rose-100 text-rose-700 border-rose-200",
      detailTitle: "发布失败原因",
      detailMessage,
      detailHint: "修改文章后重新保存，就会再次进入发布流程。",
    };
  }

  if (toNumber(article.status, 0) === 4 && rawError) {
    return {
      label: "审核未通过",
      className: "bg-rose-100 text-rose-700 border-rose-200",
      detailTitle: "审核反馈",
      detailMessage: rawError,
    };
  }

  return getStatusMeta(article.status);
};

export default function ProfileArticlesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArticleItem | null>(null);

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/profile/articles");
      return;
    }

    if (!userToken) {
      setErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setIsLoading(false);
      return;
    }

    setToken(userToken);
    setErrorMessage(null);
  }, [router]);

  const loadArticles = useCallback(async (currentToken: string, nextPage: number) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const profile = await getUserProfile(currentToken);
      const uid = String(profile.user.uid ?? "").trim();
      if (!uid) {
        throw new Error("当前用户信息无效，请重新登录");
      }

      setCurrentUserId(uid);
      const response = await listArticles({
        author_id: uid,
        page: nextPage,
        page_size: PAGE_SIZE,
        sort_by: "create_time",
        desc: true,
      });

      setArticles(pickArticles(response));
      setPage(toNumber(response.page, nextPage) || nextPage);
      setTotal(toNumber(response.total, 0));
    } catch (error) {
      setArticles([]);
      setTotal(0);
      setErrorMessage(error instanceof Error ? error.message : "加载文章列表失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadArticles(token, page);
  }, [loadArticles, page, refreshNonce, token]);

  const totalPages = useMemo(() => {
    if (total <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  const handleRefresh = () => {
    setSuccessMessage(null);
    setRefreshNonce((prev) => prev + 1);
  };

  const handleDeleteConfirm = async () => {
    if (!token || !deleteTarget) {
      return;
    }

    const articleId = normalizeId(deleteTarget.id ?? deleteTarget.article_id);
    if (!articleId) {
      setErrorMessage("文章编号无效，无法删除");
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteArticle(token, articleId);

      const remainingCount = articles.length - 1;
      const nextPage = remainingCount <= 0 && page > 1 ? page - 1 : page;
      setDeleteTarget(null);
      setSuccessMessage("文章已删除");

      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadArticles(token, nextPage);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除文章失败");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="py-8">
        <ProfileThemeShell className="space-y-6">
          <header className="flex flex-col gap-4 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(248,250,252,0.92))] p-6 shadow-sm shadow-sky-100/60 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm">
                <FileTextIcon className="size-3.5" />
                文章管理
              </div>
              <h1 className="text-3xl font-bold tracking-tight">管理我发布过的文章</h1>
              <p className="text-muted-foreground text-sm">
                在这里查看自己的发文状态，并快速进入查看、编辑和删除操作。
              </p>
              {currentUserId && (
                <p className="text-muted-foreground text-xs">当前作者编号：{currentUserId}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCcwIcon className={isLoading ? "size-4 animate-spin" : "size-4"} />
                {isLoading ? "刷新中..." : "刷新列表"}
              </Button>
              <Button asChild>
                <Link href="/post">
                  <PenBoxIcon className="size-4" />
                  新建文章
                </Link>
              </Button>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border p-5">
              <p className="text-muted-foreground text-sm">文章总数</p>
              <p className="mt-2 text-3xl font-bold">{total}</p>
            </div>
            <div className="rounded-2xl border p-5">
              <p className="text-muted-foreground text-sm">当前页码</p>
              <p className="mt-2 text-3xl font-bold">
                {page} / {totalPages}
              </p>
            </div>
            <div className="rounded-2xl border p-5">
              <p className="text-muted-foreground text-sm">每页数量</p>
              <p className="mt-2 text-3xl font-bold">{PAGE_SIZE}</p>
            </div>
          </section>

          {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
          {successMessage && <p className="text-primary text-sm">{successMessage}</p>}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`article-manage-skeleton-${index}`} className="rounded-2xl border p-5">
                  <div className="bg-muted h-5 w-40 animate-pulse rounded" />
                  <div className="bg-muted mt-4 h-4 w-full animate-pulse rounded" />
                  <div className="bg-muted mt-2 h-4 w-4/5 animate-pulse rounded" />
                  <div className="bg-muted mt-6 h-9 w-48 animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-10 text-center">
              <p className="text-lg font-semibold">你还没有文章</p>
              <p className="text-muted-foreground mt-2 text-sm">
                去发布第一篇文章后，这里就会显示你的文章管理列表。
              </p>
              <div className="mt-5">
                <Button asChild>
                  <Link href="/post">立即去发布</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {articles.map((article) => {
                const articleId = normalizeId(article.id ?? article.article_id);
                const title = toText(article.title, "未命名文章");
                const cover = toText(article.cover_image_url ?? article.cover);
                const summary = buildSummary(article);
                const statusMeta = resolveArticleStatus(article);
                const secondaryTags = Array.isArray(article.secondary_tags)
                  ? article.secondary_tags.filter((tag) => typeof tag === "string" && tag.trim())
                  : [];

                return (
                  <article
                    key={articleId || title}
                    className="overflow-hidden rounded-3xl border bg-white/70 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {cover && (
                      <div className="relative h-52 w-full overflow-hidden border-b">
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
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </div>
                          <h2 className="text-xl leading-snug font-semibold">{title}</h2>
                        </div>
                        {articleId && (
                          <p className="text-muted-foreground text-xs">文章编号：{articleId}</p>
                        )}
                      </div>

                      <p className="text-muted-foreground line-clamp-3 text-sm leading-7">
                        {summary}
                      </p>

                      {statusMeta.detailMessage && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                          <p className="text-sm font-semibold text-rose-700">
                            {statusMeta.detailTitle ?? "失败原因"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-rose-700">
                            {statusMeta.detailMessage}
                          </p>
                          {statusMeta.detailHint && (
                            <p className="mt-2 text-xs text-rose-600">{statusMeta.detailHint}</p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {secondaryTags.slice(0, 5).map((tag) => (
                          <span
                            key={`${articleId}-${tag}`}
                            className="rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 md:grid-cols-4">
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
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <p className="text-xs text-slate-500">最近更新</p>
                          <p className="mt-1 font-semibold">{formatTime(article.update_time)}</p>
                        </div>
                      </div>

                      <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
                        <span>创建时间：{formatTime(article.create_time)}</span>
                        <span>更新时间：{formatTime(article.update_time)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {articleId && (
                          <Button asChild variant="outline">
                            <Link href={`/article/${encodeURIComponent(articleId)}`}>查看文章</Link>
                          </Button>
                        )}
                        {articleId && (
                          <Button asChild variant="secondary">
                            <Link href={`/post/edit/${encodeURIComponent(articleId)}`}>
                              编辑文章
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          onClick={() => setDeleteTarget(article)}
                          disabled={!articleId}
                        >
                          <Trash2Icon className="size-4" />
                          删除文章
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!isLoading && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
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

          <AlertDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除这篇文章？</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget
                    ? `《${toText(deleteTarget.title, "未命名文章")}》删除后将不会继续在文章列表中保留。`
                    : "删除后将无法继续保留在当前列表中。"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void handleDeleteConfirm();
                  }}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                  disabled={isDeleting}
                >
                  {isDeleting ? "删除中..." : "确认删除"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
