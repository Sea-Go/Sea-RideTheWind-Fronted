"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { type ArticleItem, getArticle } from "@/services/article";
import { getAuthToken } from "@/services/auth";
import { type CommentItem, getCommentList } from "@/services/comment";
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

const PAGE_SIZE = 10;

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

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const articleId = useMemo(() => decodeURIComponent(params.id), [params.id]);

  const [token, setToken] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleItem | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [articleError, setArticleError] = useState<string | null>(null);

  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [likeState, setLikeState] = useState<LikeState>(LIKE_STATE.NONE);
  const [isReacting, setIsReacting] = useState(false);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentPage, setCommentPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAuthToken());
  }, []);

  const loadComments = useCallback(
    async (authToken: string, page: number, append: boolean) => {
      setIsLoadingComments(true);
      if (!append) {
        setCommentError(null);
      }

      try {
        const response = await getCommentList(authToken, {
          target_type: "article",
          target_id: articleId,
          sort_type: 0,
          root_id: 0,
          page,
          page_size: PAGE_SIZE,
        });

        const nextComments = Array.isArray(response.comment) ? response.comment : [];
        setComments((prev) => (append ? [...prev, ...nextComments] : nextComments));
        setCommentPage(page);

        const totalCount = toNumber(response.subject?.total_count, 0);
        if (totalCount > 0) {
          setHasMoreComments(page * PAGE_SIZE < totalCount);
        } else {
          setHasMoreComments(nextComments.length >= PAGE_SIZE);
        }
        setCommentError(null);
      } catch (error) {
        setCommentError(error instanceof Error ? error.message : "评论加载失败，请重试");
        if (!append) {
          setComments([]);
        }
      } finally {
        setIsLoadingComments(false);
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

  const handleLoadMoreComments = async () => {
    if (!token || isLoadingComments || !hasMoreComments) {
      return;
    }
    await loadComments(token, commentPage + 1, true);
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
  const author = toText(article.author_name ?? article.username, "匿名用户");
  const createdAt = toText(article.create_time ?? article.created_at ?? article.published_at, "--");

  return (
    <Layout>
      <PageContainer className="space-y-8 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/recommend">返回推荐页</Link>
            </Button>
            {token && (
              <Button asChild variant="secondary">
                <Link href={`/post/edit/${encodeURIComponent(articleId)}`}>去编辑</Link>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={likeState === LIKE_STATE.LIKED ? "default" : "secondary"}
              onClick={handleLike}
              disabled={isReacting}
            >
              👍 {likeCount}
            </Button>
            <Button
              variant={likeState === LIKE_STATE.DISLIKED ? "destructive" : "secondary"}
              onClick={handleDislike}
              disabled={isReacting}
            >
              👎 {dislikeCount}
            </Button>
          </div>
        </div>

        {reactionMessage && <p className="text-destructive text-sm">{reactionMessage}</p>}

        <article className="space-y-6 rounded-xl border p-6">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">
              作者：{author} · 发布时间：{createdAt}
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

          <section className="text-foreground leading-7 whitespace-pre-wrap">{content}</section>
        </article>

        <section className="space-y-4 rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">评论</h2>
            <Button variant="outline" disabled>
              评论发布待开放
            </Button>
          </div>

          {!token && <p className="text-muted-foreground text-sm">登录后可查看评论内容</p>}

          {commentError && token && <p className="text-destructive text-sm">{commentError}</p>}

          {token && !commentError && comments.length === 0 && !isLoadingComments && (
            <p className="text-muted-foreground text-sm">暂无评论</p>
          )}

          {comments.length > 0 && (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-2 rounded-lg border p-4">
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>用户 {comment.user_id}</span>
                    <span>{comment.created_at}</span>
                  </div>
                  <p className="text-sm leading-6">{comment.content}</p>
                  <div className="text-muted-foreground text-xs">
                    👍 {comment.like_count} · 👎 {comment.dislike_count} · 回复{" "}
                    {comment.reply_count}
                  </div>
                </div>
              ))}
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
        </section>
      </PageContainer>
    </Layout>
  );
}
