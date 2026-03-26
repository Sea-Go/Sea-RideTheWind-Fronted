"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FavoritePickerDialog } from "@/components/favorite/FavoritePickerDialog";
import { MarkdownArticle } from "@/components/article/MarkdownArticle";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { type ArticleItem, getArticle } from "@/services/article";
import { getAuthToken, getUserProfile } from "@/services/auth";
import {
  type CommentId,
  type CommentItem,
  type CommentSubject,
  createComment,
  getCommentReplies,
  getRootComments,
} from "@/services/comment";
import {
  applyReactionStep,
  buildReactionSteps,
  getLikeCount,
  getLikeState,
  LIKE_STATE,
  likeAction,
  type LikeState,
  type ReactionTarget,
  resolveReactionFinalState,
  toLikeState,
} from "@/services/like";
import {
  deleteArticleFavorites,
  getArticleFavorites,
  loadFavoriteInventory,
  type FavoriteItem,
} from "@/services/favorite";

const PAGE_SIZE = 10;

interface ReplyThreadState {
  expanded: boolean;
  initialized: boolean;
  items: CommentItem[];
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toArticleItem = (value: unknown): ArticleItem | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const article = asRecord(record.article);
  if (article) {
    return article as ArticleItem;
  }

  return record as ArticleItem;
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

const toCommentIdKey = (id: CommentId): string => String(id);

const createEmptyReplyThreadState = (): ReplyThreadState => ({
  expanded: false,
  initialized: false,
  items: [],
  page: 0,
  hasMore: false,
  isLoading: false,
  error: null,
});

const mergeFavoriteItems = (items: FavoriteItem[]): FavoriteItem[] => {
  const itemMap = new Map<string, FavoriteItem>();
  for (const item of items) {
    if (!item.favoriteId) {
      continue;
    }
    itemMap.set(item.favoriteId, item);
  }
  return Array.from(itemMap.values());
};

const resolveArticleTargetId = (article: ArticleItem | null, fallbackId: string): string => {
  if (article?.id !== undefined && article.id !== null && String(article.id).trim()) {
    return String(article.id).trim();
  }
  if (
    article?.article_id !== undefined &&
    article.article_id !== null &&
    String(article.article_id).trim()
  ) {
    return String(article.article_id).trim();
  }
  return fallbackId;
};

const normalizeCommentSubject = (value: unknown): CommentSubject | null => {
  const subject = asRecord(value);
  return subject ? (subject as unknown as CommentSubject) : null;
};

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const articleId = useMemo(() => decodeURIComponent(params.id), [params.id]);

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleItem | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [articleError, setArticleError] = useState<string | null>(null);

  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [likeState, setLikeState] = useState<LikeState>(LIKE_STATE.NONE);
  const [isReacting, setIsReacting] = useState(false);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [isFavoriteBusy, setIsFavoriteBusy] = useState(false);
  const [isFavoriteDialogOpen, setIsFavoriteDialogOpen] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentSubject, setCommentSubject] = useState<CommentSubject | null>(null);
  const [commentPage, setCommentPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentSubmitMessage, setCommentSubmitMessage] = useState<string | null>(null);
  const [replyStateByRootId, setReplyStateByRootId] = useState<Record<string, ReplyThreadState>>(
    {},
  );

  useEffect(() => {
    const currentToken = getAuthToken();
    setToken(currentToken);

    if (!currentToken) {
      setCurrentUserId(null);
      return;
    }

    void (async () => {
      try {
        const profile = await getUserProfile(currentToken);
        const uid = String(profile.user.uid ?? "").trim();
        setCurrentUserId(uid || null);
      } catch (error) {
        console.warn("Failed to load current user profile:", error);
        setCurrentUserId(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token || !article) {
      setFavoriteItems([]);
      setFavoriteMessage(null);
      return;
    }

    void (async () => {
      try {
        const inventory = await loadFavoriteInventory(token);
        setFavoriteItems(
          getArticleFavorites(inventory, resolveArticleTargetId(article, articleId)),
        );
      } catch (error) {
        console.warn("Failed to load article favorite state:", error);
      }
    })();
  }, [article, articleId, token]);

  const loadComments = useCallback(
    async (authToken: string, page: number, append: boolean) => {
      setIsLoadingComments(true);
      if (!append) {
        setCommentError(null);
      }

      try {
        const response = await getRootComments(authToken, {
          target_type: "article",
          target_id: articleId,
          sort_type: 0,
          page,
          page_size: PAGE_SIZE,
        });

        const nextComments = Array.isArray(response.comment) ? response.comment : [];
        const nextSubject = normalizeCommentSubject(response.subject);
        setComments((prev) => (append ? [...prev, ...nextComments] : nextComments));
        setCommentSubject(nextSubject);
        setCommentPage(page);

        const rootCount = toNumber(nextSubject?.root_count, 0);
        if (rootCount > 0) {
          setHasMoreComments(page * PAGE_SIZE < rootCount);
        } else {
          setHasMoreComments(nextComments.length >= PAGE_SIZE);
        }

        if (!append) {
          setReplyStateByRootId({});
        }
        setCommentError(null);
      } catch (error) {
        setCommentError(error instanceof Error ? error.message : "评论加载失败，请重试");
        if (!append) {
          setComments([]);
          setCommentSubject(null);
          setReplyStateByRootId({});
        }
      } finally {
        setIsLoadingComments(false);
      }
    },
    [articleId],
  );

  const loadReplies = useCallback(
    async (
      authToken: string,
      rootId: CommentId,
      replyCount: number,
      page: number,
      append: boolean,
    ) => {
      const rootKey = toCommentIdKey(rootId);
      setReplyStateByRootId((prev) => {
        const prevState = prev[rootKey] ?? createEmptyReplyThreadState();
        return {
          ...prev,
          [rootKey]: {
            ...prevState,
            expanded: true,
            initialized: true,
            isLoading: true,
            error: null,
          },
        };
      });

      try {
        const response = await getCommentReplies(authToken, {
          target_type: "article",
          target_id: articleId,
          sort_type: 0,
          root_id: rootId,
          page,
          page_size: PAGE_SIZE,
        });

        const nextReplies = Array.isArray(response.comment) ? response.comment : [];
        const totalCount = toNumber(response.subject?.total_count, 0);
        setReplyStateByRootId((prev) => {
          const prevState = prev[rootKey] ?? createEmptyReplyThreadState();
          const mergedItems = append ? [...prevState.items, ...nextReplies] : nextReplies;
          const loadedCount = mergedItems.length;
          const hasMore =
            totalCount > 0
              ? page * PAGE_SIZE < totalCount
              : replyCount > 0
                ? loadedCount < replyCount
                : nextReplies.length >= PAGE_SIZE;

          return {
            ...prev,
            [rootKey]: {
              ...prevState,
              expanded: true,
              initialized: true,
              items: mergedItems,
              page,
              hasMore,
              isLoading: false,
              error: null,
            },
          };
        });
      } catch (error) {
        setReplyStateByRootId((prev) => {
          const prevState = prev[rootKey] ?? createEmptyReplyThreadState();
          return {
            ...prev,
            [rootKey]: {
              ...prevState,
              expanded: true,
              initialized: true,
              isLoading: false,
              error: error instanceof Error ? error.message : "回复加载失败，请重试",
            },
          };
        });
      }
    },
    [articleId],
  );

  const syncLikeStats = useCallback(
    async (
      authToken: string,
      fallback: { likeCount: number; dislikeCount: number; likeState: LikeState },
    ): Promise<boolean> => {
      try {
        const [countResult, stateResult] = await Promise.all([
          getLikeCount(authToken, {
            target_type: "article",
            target_ids: [articleId],
          }),
          getLikeState(authToken, {
            target_type: "article",
            target_ids: [articleId],
          }),
        ]);

        const counters = countResult.counts?.[articleId];
        setLikeCount(toNumber(counters?.like_count, fallback.likeCount));
        setDislikeCount(toNumber(counters?.dislike_count, fallback.dislikeCount));
        setLikeState(toLikeState(stateResult.states?.[articleId], fallback.likeState));
        return true;
      } catch (error) {
        console.warn("Failed to load like state:", error);
        return false;
      }
    },
    [articleId],
  );

  useEffect(() => {
    const loadArticle = async () => {
      setIsLoadingArticle(true);
      setArticleError(null);
      setReactionMessage(null);

      try {
        const articlePayload = await getArticle(articleId, {
          token: token ?? undefined,
          incr_view: true,
        });

        const normalizedArticle = toArticleItem(articlePayload);
        if (!normalizedArticle) {
          throw new Error("文章数据为空");
        }

        const initialLikes = toNumber(normalizedArticle.like_count ?? normalizedArticle.likes, 0);
        setArticle(normalizedArticle);
        setLikeCount(initialLikes);
        setDislikeCount(0);
        setLikeState(LIKE_STATE.NONE);

        if (token) {
          setReplyStateByRootId({});
          await Promise.all([
            syncLikeStats(token, {
              likeCount: initialLikes,
              dislikeCount: 0,
              likeState: LIKE_STATE.NONE,
            }),
            loadComments(token, 1, false),
          ]);
        } else {
          setComments([]);
          setCommentSubject(null);
          setReplyStateByRootId({});
          setHasMoreComments(false);
          setCommentError("登录后可查看评论内容");
        }
      } catch (error) {
        setArticleError(error instanceof Error ? error.message : "文章加载失败");
        setArticle(null);
      } finally {
        setIsLoadingArticle(false);
      }
    };

    void loadArticle();
  }, [articleId, loadComments, syncLikeStats, token]);

  const handleReaction = async (targetState: ReactionTarget) => {
    if (!token) {
      router.push("/login");
      return;
    }

    if (isReacting) {
      return;
    }

    const previousLikeCount = likeCount;
    const previousDislikeCount = dislikeCount;
    const previousLikeState = likeState;
    const steps = buildReactionSteps(previousLikeState, targetState);
    const finalState = resolveReactionFinalState(previousLikeState, targetState);

    setReactionMessage(null);
    setIsReacting(true);

    let nextLikeCount = previousLikeCount;
    let nextDislikeCount = previousDislikeCount;
    let nextLikeState = previousLikeState;

    try {
      for (const step of steps) {
        const result = await likeAction(token, {
          target_type: "article",
          target_id: articleId,
          action_type: step,
          author_id:
            article?.author_id !== undefined && article?.author_id !== null
              ? String(article.author_id)
              : undefined,
          weight: 1,
        });

        nextLikeCount = toNumber(result.like_count, nextLikeCount);
        nextDislikeCount = toNumber(result.dislike_count, nextDislikeCount);
        nextLikeState = applyReactionStep(nextLikeState, step);

        setLikeCount(nextLikeCount);
        setDislikeCount(nextDislikeCount);
        setLikeState(nextLikeState);
      }

      setLikeState(finalState);
    } catch (error) {
      console.warn("Failed to react article:", error);
      const synced = await syncLikeStats(token, {
        likeCount: previousLikeCount,
        dislikeCount: previousDislikeCount,
        likeState: previousLikeState,
      });

      if (!synced) {
        setLikeCount(previousLikeCount);
        setDislikeCount(previousDislikeCount);
        setLikeState(previousLikeState);
      }

      setReactionMessage("操作失败，已同步最新状态");
    } finally {
      setIsReacting(false);
    }
  };

  const handleLike = async () => {
    await handleReaction(LIKE_STATE.LIKED);
  };

  const handleDislike = async () => {
    await handleReaction(LIKE_STATE.DISLIKED);
  };

  const handleToggleFavorite = async () => {
    if (!token || !article) {
      router.push("/login");
      return;
    }
    if (isFavoriteBusy) {
      return;
    }

    setFavoriteMessage(null);
    if (favoriteItems.length === 0) {
      setIsFavoriteDialogOpen(true);
      return;
    }

    setIsFavoriteBusy(true);
    try {
      await deleteArticleFavorites(token, favoriteItems);
      setFavoriteItems([]);
      setFavoriteMessage("已取消收藏");
    } catch (error) {
      setFavoriteMessage(error instanceof Error ? error.message : "收藏失败，请稍后重试");
    } finally {
      setIsFavoriteBusy(false);
    }
  };

  const handleLoadMoreComments = async () => {
    if (!token || isLoadingComments || !hasMoreComments) {
      return;
    }
    await loadComments(token, commentPage + 1, true);
  };

  const handleSubmitComment = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    const content = commentDraft.trim();
    if (!content) {
      setCommentSubmitMessage("请输入评论内容后再提交。");
      return;
    }

    setIsSubmittingComment(true);
    setCommentSubmitMessage(null);
    setCommentError(null);

    try {
      await createComment(token, {
        target_type: "article",
        target_id: articleId,
        content,
      });
      setCommentDraft("");
      await loadComments(token, 1, false);
      setCommentSubmitMessage("评论已发布。");
    } catch (error) {
      setCommentSubmitMessage(error instanceof Error ? error.message : "评论发布失败，请稍后重试");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleToggleReplies = async (comment: CommentItem) => {
    if (!token) {
      return;
    }

    const rootKey = toCommentIdKey(comment.id);
    const currentState = replyStateByRootId[rootKey];

    if (currentState?.expanded) {
      setReplyStateByRootId((prev) => ({
        ...prev,
        [rootKey]: {
          ...currentState,
          expanded: false,
        },
      }));
      return;
    }

    if (currentState?.initialized) {
      setReplyStateByRootId((prev) => ({
        ...prev,
        [rootKey]: {
          ...currentState,
          expanded: true,
          error: null,
        },
      }));
      return;
    }

    const initialReplies = Array.isArray(comment.children) ? comment.children : [];
    if (initialReplies.length > 0) {
      const replyCount = toNumber(comment.reply_count, initialReplies.length);
      setReplyStateByRootId((prev) => ({
        ...prev,
        [rootKey]: {
          expanded: true,
          initialized: true,
          items: initialReplies,
          page: 1,
          hasMore: replyCount > initialReplies.length,
          isLoading: false,
          error: null,
        },
      }));
      return;
    }

    await loadReplies(token, comment.id, toNumber(comment.reply_count, 0), 1, false);
  };

  const handleLoadMoreReplies = async (comment: CommentItem) => {
    if (!token) {
      return;
    }

    const rootKey = toCommentIdKey(comment.id);
    const replyState = replyStateByRootId[rootKey];
    if (!replyState || replyState.isLoading || !replyState.hasMore) {
      return;
    }

    await loadReplies(
      token,
      comment.id,
      toNumber(comment.reply_count, 0),
      replyState.page + 1,
      true,
    );
  };

  const handleRetryReplies = async (comment: CommentItem) => {
    if (!token) {
      return;
    }
    await loadReplies(token, comment.id, toNumber(comment.reply_count, 0), 1, false);
  };

  if (isLoadingArticle) {
    return (
      <Layout>
        <PageContainer className="py-8">
          <p className="text-muted-foreground">文章加载中...</p>
        </PageContainer>
      </Layout>
    );
  }

  if (articleError || !article) {
    return (
      <Layout>
        <PageContainer className="space-y-4 py-8">
          <p className="text-destructive">{articleError ?? "文章不存在或已删除"}</p>
          <Button asChild variant="outline">
            <Link href="/dashboard/recommend">返回推荐页</Link>
          </Button>
        </PageContainer>
      </Layout>
    );
  }

  const title = toText(article.title, "未命名文章");
  const content = toText(article.content, "暂无正文");
  const brief = toText(article.brief);
  const cover = toText(article.cover_image_url ?? article.cover);
  const author = toText(
    article.author_name ?? article.username,
    article.author_id ? `用户 ${String(article.author_id)}` : "未知作者",
  );
  const authorId =
    article.author_id !== undefined && article.author_id !== null
      ? String(article.author_id).trim()
      : "";
  const authorSpaceHref = authorId
    ? `/author/${encodeURIComponent(authorId)}?name=${encodeURIComponent(author)}`
    : null;
  const createdAt = toText(article.create_time ?? article.created_at ?? article.published_at, "--");
  const rootCommentCount = toNumber(commentSubject?.root_count, comments.length);
  const totalCommentCount = toNumber(commentSubject?.total_count, rootCommentCount);
  const canEdit =
    !!currentUserId &&
    article.author_id !== undefined &&
    article.author_id !== null &&
    currentUserId === String(article.author_id).trim();
  const favoriteTarget = {
    targetId: resolveArticleTargetId(article, articleId),
    title,
    cover: cover || null,
  };

  return (
    <Layout>
      <PageContainer className="space-y-8 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/recommend">返回推荐页</Link>
            </Button>
            {canEdit && (
              <Button asChild variant="secondary">
                <Link href={`/post/edit/${encodeURIComponent(articleId)}`}>去编辑</Link>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={favoriteItems.length > 0 ? "default" : "outline"}
              onClick={() => void handleToggleFavorite()}
              disabled={isFavoriteBusy}
            >
              {isFavoriteBusy ? "处理中..." : favoriteItems.length > 0 ? "已收藏" : "收藏"}
            </Button>
            <Button
              id="article-like-button"
              variant={likeState === LIKE_STATE.LIKED ? "default" : "secondary"}
              onClick={handleLike}
              disabled={isReacting}
            >
              👍 {likeCount}
            </Button>
            <Button
              id="article-dislike-button"
              variant={likeState === LIKE_STATE.DISLIKED ? "destructive" : "secondary"}
              onClick={handleDislike}
              disabled={isReacting}
            >
              👎 {dislikeCount}
            </Button>
          </div>
        </div>

        {reactionMessage && <p className="text-destructive text-sm">{reactionMessage}</p>}
        {favoriteMessage && <p className="text-primary text-sm">{favoriteMessage}</p>}

        <article className="space-y-6 rounded-xl border p-6">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">
              作者：
              {authorSpaceHref ? (
                <Link
                  href={authorSpaceHref}
                  className="ml-1 font-medium text-sky-700 underline-offset-4 transition hover:text-sky-600 hover:underline"
                >
                  {author}
                </Link>
              ) : (
                <span className="ml-1">{author}</span>
              )}
              <span className="mx-2">·</span>
              发布时间：{createdAt}
            </p>
            {brief && <p className="text-muted-foreground">{brief}</p>}
            {!!cover && (
              <div className="overflow-hidden rounded-lg border">
                <Image
                  src={cover}
                  alt={title}
                  width={1200}
                  height={720}
                  unoptimized
                  className="max-h-[420px] w-full object-cover"
                />
              </div>
            )}
          </header>

          <div className="text-muted-foreground flex gap-4 text-sm">
            <span>点赞：{likeCount}</span>
            <span>点踩：{dislikeCount}</span>
          </div>

          <section>
            <MarkdownArticle value={content} />
          </section>
        </article>

        <section className="space-y-4 rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">
                评论
                {token && !commentError ? `（${rootCommentCount}）` : ""}
              </h2>
              {token && !commentError && (
                <p className="text-muted-foreground text-xs">
                  总评论（含回复）：{totalCommentCount}
                </p>
              )}
            </div>
            <Button
              id="article-comment-submit"
              variant="outline"
              onClick={() => void handleSubmitComment()}
              disabled={!token || isSubmittingComment || !commentDraft.trim()}
            >
              {isSubmittingComment ? "发布中..." : "发布评论"}
            </Button>
          </div>

          {!token && <p className="text-muted-foreground text-sm">登录后可查看评论内容</p>}

          {token && (
            <div className="space-y-3 rounded-lg border p-4">
              <label htmlFor="article-comment-draft" className="text-sm font-medium">
                写下你的评论
              </label>
              <textarea
                id="article-comment-draft"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                rows={4}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[112px] rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                placeholder="写点你的看法，支持纯文本评论。"
                disabled={isSubmittingComment}
              />
              {commentSubmitMessage && (
                <p
                  id="article-comment-submit-message"
                  data-status={
                    commentSubmitMessage.includes("失败") || commentSubmitMessage.includes("请输入")
                      ? "error"
                      : "success"
                  }
                  className={`text-sm ${
                    commentSubmitMessage.includes("失败") || commentSubmitMessage.includes("请输入")
                      ? "text-destructive"
                      : "text-emerald-600"
                  }`}
                >
                  {commentSubmitMessage}
                </p>
              )}
            </div>
          )}

          {commentError && token && <p className="text-destructive text-sm">{commentError}</p>}

          {token && !commentError && comments.length === 0 && !isLoadingComments && (
            <p className="text-muted-foreground text-sm">暂无评论</p>
          )}

          {comments.length > 0 && (
            <div className="space-y-3">
              {comments.map((comment) => {
                const rootKey = toCommentIdKey(comment.id);
                const replyState = replyStateByRootId[rootKey];
                const replyCount = toNumber(comment.reply_count, 0);
                const canToggleReplies = replyCount > 0;

                return (
                  <div key={rootKey} className="space-y-3 rounded-lg border p-4">
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>用户 {comment.user_id}</span>
                      <span>{comment.created_at}</span>
                    </div>
                    <p className="text-sm leading-6">{comment.content}</p>
                    <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                      <span>
                        👍 {comment.like_count} · 👎 {comment.dislike_count} · 回复 {replyCount}
                      </span>
                      {canToggleReplies && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleToggleReplies(comment)}
                          disabled={replyState?.isLoading}
                        >
                          {replyState?.expanded ? "收起回复" : `查看回复（${replyCount}）`}
                        </Button>
                      )}
                    </div>

                    {replyState?.expanded && (
                      <div className="ml-4 space-y-2 border-l pl-4">
                        {replyState.error && (
                          <div className="space-y-2">
                            <p className="text-destructive text-xs">{replyState.error}</p>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleRetryReplies(comment)}
                              disabled={replyState.isLoading}
                            >
                              {replyState.isLoading ? "重试中..." : "重试加载回复"}
                            </Button>
                          </div>
                        )}

                        {!replyState.error &&
                          !replyState.isLoading &&
                          replyState.items.length === 0 && (
                            <p className="text-muted-foreground text-xs">暂无回复</p>
                          )}

                        {replyState.items.map((reply, index) => {
                          const replyKey = `${rootKey}-${toCommentIdKey(reply.id)}-${index}`;
                          return (
                            <div key={replyKey} className="space-y-1 rounded-md border px-3 py-2">
                              <div className="text-muted-foreground flex items-center justify-between text-xs">
                                <span>用户 {reply.user_id}</span>
                                <span>{reply.created_at}</span>
                              </div>
                              <p className="text-sm leading-6">{reply.content}</p>
                              <p className="text-muted-foreground text-xs">
                                👍 {reply.like_count} · 👎 {reply.dislike_count}
                              </p>
                            </div>
                          );
                        })}

                        {replyState.hasMore && !replyState.error && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleLoadMoreReplies(comment)}
                            disabled={replyState.isLoading}
                          >
                            {replyState.isLoading ? "加载中..." : "加载更多回复"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {token && hasMoreComments && (
            <Button
              variant="secondary"
              onClick={handleLoadMoreComments}
              disabled={isLoadingComments}
            >
              {isLoadingComments ? "加载中..." : "加载更多评论"}
            </Button>
          )}

          <FavoritePickerDialog
            open={isFavoriteDialogOpen}
            token={token}
            target={favoriteTarget}
            onOpenChange={setIsFavoriteDialogOpen}
            onSaved={(favorite) => {
              setFavoriteItems((prev) => mergeFavoriteItems([...prev, favorite]));
              setFavoriteMessage("已加入收藏夹");
            }}
          />
        </section>
      </PageContainer>
    </Layout>
  );
}
