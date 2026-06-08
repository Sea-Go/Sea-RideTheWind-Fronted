"use client";

import { MessageCircleIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MarkdownArticle } from "@/components/article/MarkdownArticle";
import { FavoritePickerDialog } from "@/components/favorite/FavoritePickerDialog";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { type ArticleItem, getArticle } from "@/services/article";
import {
  getAuthToken,
  getProfileAvatarUrl,
  getUserProfile,
  type UserProfile,
} from "@/services/auth";
import {
  COMMENT_ACTION,
  type CommentActionType,
  type CommentId,
  type CommentItem,
  type CommentSubject,
  createComment,
  getCommentReplies,
  getRootComments,
  likeComment,
} from "@/services/comment";
import {
  deleteArticleFavorites,
  type FavoriteItem,
  getArticleFavorites,
  loadFavoriteInventory,
} from "@/services/favorite";
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

interface ReplyThreadState {
  expanded: boolean;
  initialized: boolean;
  items: CommentItem[];
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

interface CommentReactionState {
  likeState: LikeState;
  busy: boolean;
}

interface ReplyComposerState {
  parentId: CommentId;
  parentUserId: CommentId;
  parentUserName: string;
  draft: string;
  isSubmitting: boolean;
  error: string | null;
}

const DEFAULT_COMMENT_REACTION_STATE: CommentReactionState = {
  likeState: LIKE_STATE.NONE,
  busy: false,
};

interface ParsedCommentMeta {
  authorName?: string;
  authorAvatarUrl?: string;
  replyToUserId?: string;
  replyToName?: string;
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

const toOptionalText = (value: unknown): string =>
  typeof value === "string"
    ? value.trim()
    : value === undefined || value === null
      ? ""
      : String(value).trim();

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

const parseCommentMeta = (meta: unknown): ParsedCommentMeta => {
  const raw = typeof meta === "string" ? meta.trim() : "";
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    if (!record) {
      return {};
    }
    return {
      authorName: toOptionalText(
        record.author_name ?? record.authorName ?? record.username ?? record.display_name,
      ),
      authorAvatarUrl: toOptionalText(
        record.author_avatar_url ?? record.authorAvatarUrl ?? record.avatar_url ?? record.avatarUrl,
      ),
      replyToUserId: toOptionalText(record.reply_to_user_id ?? record.replyToUserId),
      replyToName: toOptionalText(record.reply_to_name ?? record.replyToName),
    };
  } catch {
    return {};
  }
};

const getCommentFieldText = (comment: CommentItem, keys: string[]): string => {
  const record = comment as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = toOptionalText(record[key]);
    if (value) {
      return value;
    }
  }
  return "";
};

const isCurrentUserComment = (
  comment: CommentItem,
  currentUserProfile: UserProfile | null,
): boolean => {
  const uid = toOptionalText(currentUserProfile?.uid);
  return Boolean(uid) && toCommentIdKey(comment.user_id) === uid;
};

const getCommentAuthorView = (
  comment: CommentItem,
  currentUserProfile: UserProfile | null,
): { uid: string; name: string; avatarUrl: string } => {
  const meta = parseCommentMeta(comment.meta);
  const uid = toCommentIdKey(comment.user_id);
  if (isCurrentUserComment(comment, currentUserProfile)) {
    return {
      uid,
      name: toOptionalText(currentUserProfile?.username) || `用户 ${uid}`,
      avatarUrl: getProfileAvatarUrl(currentUserProfile),
    };
  }

  const fieldName = getCommentFieldText(comment, ["author_name", "username", "display_name"]);
  const fieldAvatar = getCommentFieldText(comment, [
    "author_avatar_url",
    "avatar_url",
    "avatarUrl",
  ]);
  return {
    uid,
    name: fieldName || meta.authorName || `用户 ${uid}`,
    avatarUrl: fieldAvatar || meta.authorAvatarUrl || "",
  };
};

const findThreadCommentById = (
  id: CommentId,
  rootComment: CommentItem,
  replies: CommentItem[],
): CommentItem | null => {
  const targetKey = toCommentIdKey(id);
  if (toCommentIdKey(rootComment.id) === targetKey) {
    return rootComment;
  }
  return replies.find((reply) => toCommentIdKey(reply.id) === targetKey) ?? null;
};

const getReplyTargetName = (
  reply: CommentItem,
  parentComment: CommentItem | null,
  currentUserProfile: UserProfile | null,
): string => {
  const meta = parseCommentMeta(reply.meta);
  if (meta.replyToName) {
    return meta.replyToName;
  }
  if (parentComment) {
    return getCommentAuthorView(parentComment, currentUserProfile).name;
  }
  return "上级评论";
};

const buildCommentMeta = (
  currentUserProfile: UserProfile | null,
  replyTo?: { userId: CommentId; name: string },
): string => {
  const payload: Record<string, string> = {};
  const username = toOptionalText(currentUserProfile?.username);
  const avatarUrl = getProfileAvatarUrl(currentUserProfile);
  if (username) {
    payload.author_name = username;
  }
  if (avatarUrl) {
    payload.author_avatar_url = avatarUrl;
  }
  if (replyTo) {
    payload.reply_to_user_id = toCommentIdKey(replyTo.userId);
    payload.reply_to_name = replyTo.name;
  }
  return JSON.stringify(payload);
};

const toRawCommentInteger = (id: CommentId, { allowZero = false } = {}): string | null => {
  const rawId = String(id).trim();
  if (!/^\d+$/.test(rawId)) {
    return null;
  }

  if (!allowZero && rawId === "0") {
    return null;
  }

  return rawId;
};

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
  const routeId = fallbackId.trim();
  if (routeId) {
    return routeId;
  }

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

const updateCommentTreeById = (
  items: CommentItem[],
  targetId: CommentId,
  updater: (item: CommentItem) => CommentItem,
): CommentItem[] => {
  const targetKey = toCommentIdKey(targetId);
  let changed = false;

  const nextItems = items.map((item) => {
    const itemKey = toCommentIdKey(item.id);
    const nextChildren = Array.isArray(item.children)
      ? updateCommentTreeById(item.children, targetId, updater)
      : item.children;

    let nextItem = itemKey === targetKey ? updater(item) : item;
    if (nextChildren && nextChildren !== item.children) {
      nextItem = {
        ...nextItem,
        children: nextChildren,
      };
    }

    if (nextItem !== item) {
      changed = true;
    }

    return nextItem;
  });

  return changed ? nextItems : items;
};

const applyCommentReactionStep = (comment: CommentItem, step: CommentActionType): CommentItem => {
  const likeCount = toNumber(comment.like_count, 0);
  const dislikeCount = toNumber(comment.dislike_count, 0);

  switch (step) {
    case COMMENT_ACTION.LIKE:
      return {
        ...comment,
        like_count: likeCount + 1,
      };
    case COMMENT_ACTION.CANCEL_LIKE:
      return {
        ...comment,
        like_count: Math.max(0, likeCount - 1),
      };
    case COMMENT_ACTION.DISLIKE:
      return {
        ...comment,
        dislike_count: dislikeCount + 1,
      };
    case COMMENT_ACTION.CANCEL_DISLIKE:
      return {
        ...comment,
        dislike_count: Math.max(0, dislikeCount - 1),
      };
    default:
      return comment;
  }
};

function CommentReactionControls({
  comment,
  likeState,
  isBusy,
  onLike,
  onDislike,
}: {
  comment: CommentItem;
  likeState: LikeState;
  isBusy: boolean;
  onLike: (comment: CommentItem) => void;
  onDislike: (comment: CommentItem) => void;
}) {
  const commentKey = toCommentIdKey(comment.id);
  const likeActive = likeState === LIKE_STATE.LIKED;
  const dislikeActive = likeState === LIKE_STATE.DISLIKED;

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <Button
        id={`comment-${commentKey}-like-button`}
        type="button"
        size="sm"
        variant={likeActive ? "default" : "ghost"}
        aria-pressed={likeActive}
        data-comment-id={commentKey}
        data-comment-action="like"
        onClick={() => onLike(comment)}
        disabled={isBusy}
        className="w-full sm:w-auto"
      >
        <ThumbsUpIcon className="size-3.5" />
        <span>赞</span>
        <span>{toNumber(comment.like_count, 0)}</span>
      </Button>
      <Button
        id={`comment-${commentKey}-dislike-button`}
        type="button"
        size="sm"
        variant={dislikeActive ? "destructive" : "ghost"}
        aria-pressed={dislikeActive}
        data-comment-id={commentKey}
        data-comment-action="dislike"
        onClick={() => onDislike(comment)}
        disabled={isBusy}
        className="w-full sm:w-auto"
      >
        <ThumbsDownIcon className="size-3.5" />
        <span>踩</span>
        <span>{toNumber(comment.dislike_count, 0)}</span>
      </Button>
    </div>
  );
}

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const articleId = useMemo(() => decodeURIComponent(params.id), [params.id]);

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [article, setArticle] = useState<ArticleItem | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [articleError, setArticleError] = useState<string | null>(null);
  const articleTargetId = useMemo(
    () => resolveArticleTargetId(article, articleId),
    [article, articleId],
  );

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
  const [commentReactionMessage, setCommentReactionMessage] = useState<string | null>(null);
  const [commentReactionById, setCommentReactionById] = useState<
    Record<string, CommentReactionState>
  >({});
  const [replyStateByRootId, setReplyStateByRootId] = useState<Record<string, ReplyThreadState>>(
    {},
  );
  const [replyComposerByRootId, setReplyComposerByRootId] = useState<
    Record<string, ReplyComposerState>
  >({});

  useEffect(() => {
    if (!token) {
      setCurrentUserId(null);
      setCurrentUserProfile(null);
      return;
    }

    void (async () => {
      try {
        const profile = await getUserProfile(token);
        const uid = String(profile.user.uid ?? "").trim();
        setCurrentUserId(uid || null);
        setCurrentUserProfile(profile.user ?? null);
      } catch (error) {
        console.warn("Failed to load current user profile:", error);
        setCurrentUserId(null);
        setCurrentUserProfile(null);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !article) {
      setFavoriteItems([]);
      setFavoriteMessage(null);
      return;
    }

    void (async () => {
      try {
        const inventory = await loadFavoriteInventory(token);
        setFavoriteItems(getArticleFavorites(inventory, articleTargetId));
      } catch (error) {
        console.warn("Failed to load article favorite state:", error);
      }
    })();
  }, [article, articleTargetId, token]);

  const loadComments = useCallback(
    async (authToken: string, targetId: string, page: number, append: boolean) => {
      setIsLoadingComments(true);
      if (!append) {
        setCommentError(null);
      }

      try {
        const response = await getRootComments(authToken, {
          target_type: "article",
          target_id: targetId,
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
          setReplyComposerByRootId({});
        }
        setCommentError(null);
      } catch (error) {
        setCommentError(error instanceof Error ? error.message : "评论加载失败，请重试");
        if (!append) {
          setComments([]);
          setCommentSubject(null);
          setReplyStateByRootId({});
          setReplyComposerByRootId({});
        }
      } finally {
        setIsLoadingComments(false);
      }
    },
    [],
  );

  const loadReplies = useCallback(
    async (
      authToken: string,
      targetId: string,
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
          target_id: targetId,
          sort_type: 0,
          root_id: rootId,
          page,
          page_size: PAGE_SIZE,
        });

        const nextReplies = Array.isArray(response.comment) ? response.comment : [];
        setReplyStateByRootId((prev) => {
          const prevState = prev[rootKey] ?? createEmptyReplyThreadState();
          const mergedItems = append ? [...prevState.items, ...nextReplies] : nextReplies;
          const loadedCount = mergedItems.length;
          const hasMore = replyCount > loadedCount || nextReplies.length >= PAGE_SIZE;

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
    [],
  );

  const syncLikeStats = useCallback(
    async (
      authToken: string,
      targetId: string,
      fallback: { likeCount: number; dislikeCount: number; likeState: LikeState },
    ): Promise<boolean> => {
      try {
        const [countResult, stateResult] = await Promise.all([
          getLikeCount(authToken, {
            target_type: "article",
            target_ids: [targetId],
          }),
          getLikeState(authToken, {
            target_type: "article",
            target_ids: [targetId],
          }),
        ]);

        const counters = countResult.counts?.[targetId];
        setLikeCount(toNumber(counters?.like_count, fallback.likeCount));
        setDislikeCount(toNumber(counters?.dislike_count, fallback.dislikeCount));
        setLikeState(toLikeState(stateResult.states?.[targetId], fallback.likeState));
        return true;
      } catch (error) {
        console.warn("Failed to load like state:", error);
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    const loadArticle = async () => {
      const currentToken = getAuthToken();
      setToken(currentToken);
      setIsLoadingArticle(true);
      setArticleError(null);
      setReactionMessage(null);
      setCommentReactionMessage(null);
      setCommentReactionById({});

      try {
        const articlePayload = await getArticle(articleId, {
          token: currentToken ?? undefined,
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
        setComments([]);
        setCommentSubject(null);
        setReplyStateByRootId({});
        setReplyComposerByRootId({});
        setHasMoreComments(false);
        setCommentError(currentToken ? null : "登录后可查看评论内容");
      } catch (error) {
        setArticleError(error instanceof Error ? error.message : "文章加载失败");
        setArticle(null);
      } finally {
        setIsLoadingArticle(false);
      }
    };

    void loadArticle();
  }, [articleId]);

  useEffect(() => {
    if (!article) {
      return;
    }

    if (!token) {
      setComments([]);
      setCommentSubject(null);
      setReplyStateByRootId({});
      setReplyComposerByRootId({});
      setHasMoreComments(false);
      setCommentError("登录后可查看评论内容");
      return;
    }

    const initialLikes = toNumber(article.like_count ?? article.likes, 0);
    void (async () => {
      setReplyStateByRootId({});
      setReplyComposerByRootId({});
      await Promise.all([
        syncLikeStats(token, articleTargetId, {
          likeCount: initialLikes,
          dislikeCount: 0,
          likeState: LIKE_STATE.NONE,
        }),
        loadComments(token, articleTargetId, 1, false),
      ]);
    })();
  }, [article, articleTargetId, loadComments, syncLikeStats, token]);

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
          target_id: articleTargetId,
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
      const synced = await syncLikeStats(token, articleTargetId, {
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

  const updateVisibleComment = useCallback(
    (commentId: CommentId, updater: (comment: CommentItem) => CommentItem) => {
      setComments((prev) => updateCommentTreeById(prev, commentId, updater));
      setReplyStateByRootId((prev) => {
        let changed = false;
        const nextState = Object.fromEntries(
          Object.entries(prev).map(([rootKey, replyState]) => {
            const nextItems = updateCommentTreeById(replyState.items, commentId, updater);
            if (nextItems !== replyState.items) {
              changed = true;
              return [
                rootKey,
                {
                  ...replyState,
                  items: nextItems,
                },
              ];
            }

            return [rootKey, replyState];
          }),
        ) as Record<string, ReplyThreadState>;

        return changed ? nextState : prev;
      });
    },
    [],
  );

  const refreshVisibleComment = useCallback(
    async (authToken: string, targetId: string, comment: CommentItem) => {
      const rootId = toRawCommentInteger(comment.root_id, { allowZero: true }) ?? "0";

      if (rootId === "0") {
        const pageSize = Math.max(commentPage * PAGE_SIZE, comments.length, PAGE_SIZE);

        try {
          const response = await getRootComments(authToken, {
            target_type: "article",
            target_id: targetId,
            sort_type: 0,
            page: 1,
            page_size: pageSize,
          });

          const nextComments = Array.isArray(response.comment) ? response.comment : [];
          const nextSubject = normalizeCommentSubject(response.subject);
          const rootCount = toNumber(nextSubject?.root_count, 0);
          setComments(nextComments);
          setCommentSubject(nextSubject);
          setHasMoreComments(
            rootCount > 0 ? nextComments.length < rootCount : nextComments.length >= pageSize,
          );
        } catch (error) {
          console.warn("Failed to refresh comment reaction counts:", error);
        }
        return;
      }

      const rootKey = rootId;
      const replyState = replyStateByRootId[rootKey];
      if (!replyState?.initialized) {
        return;
      }

      const pageSize = Math.max(replyState.page * PAGE_SIZE, replyState.items.length, PAGE_SIZE);
      const rootComment = comments.find((item) => toCommentIdKey(item.id) === rootKey);
      const rootReplyCount = toNumber(rootComment?.reply_count, 0);
      try {
        const response = await getCommentReplies(authToken, {
          target_type: "article",
          target_id: targetId,
          sort_type: 0,
          root_id: rootId,
          page: 1,
          page_size: pageSize,
        });

        const nextReplies = Array.isArray(response.comment) ? response.comment : [];
        setReplyStateByRootId((prev) => {
          const prevState = prev[rootKey] ?? createEmptyReplyThreadState();
          return {
            ...prev,
            [rootKey]: {
              ...prevState,
              initialized: true,
              items: nextReplies,
              page: replyState.page,
              hasMore: rootReplyCount > nextReplies.length || nextReplies.length >= pageSize,
              isLoading: false,
              error: null,
            },
          };
        });
      } catch (error) {
        console.warn("Failed to refresh reply reaction counts:", error);
      }
    },
    [commentPage, comments, replyStateByRootId],
  );

  const handleCommentReaction = async (comment: CommentItem, targetState: ReactionTarget) => {
    if (!token) {
      router.push("/login");
      return;
    }

    const commentId = toRawCommentInteger(comment.id);
    if (!commentId) {
      setCommentReactionMessage("当前评论暂不支持互动。");
      return;
    }

    const commentKey = toCommentIdKey(comment.id);
    const previousReaction = commentReactionById[commentKey] ?? DEFAULT_COMMENT_REACTION_STATE;
    if (previousReaction.busy) {
      return;
    }

    const steps = buildReactionSteps(previousReaction.likeState, targetState);
    const finalState = resolveReactionFinalState(previousReaction.likeState, targetState);
    let nextLikeState = previousReaction.likeState;

    setCommentReactionMessage(null);
    setCommentReactionById((prev) => ({
      ...prev,
      [commentKey]: {
        likeState: previousReaction.likeState,
        busy: true,
      },
    }));

    try {
      for (const step of steps) {
        await likeComment(token, {
          target_type: "article",
          target_id: articleTargetId,
          comment_id: commentId,
          action_type: step,
        });

        updateVisibleComment(comment.id, (item) => applyCommentReactionStep(item, step));
        nextLikeState = applyReactionStep(nextLikeState, step);
        setCommentReactionById((prev) => ({
          ...prev,
          [commentKey]: {
            likeState: nextLikeState,
            busy: true,
          },
        }));
      }

      setCommentReactionById((prev) => ({
        ...prev,
        [commentKey]: {
          likeState: finalState,
          busy: false,
        },
      }));
      await refreshVisibleComment(token, articleTargetId, comment);
    } catch (error) {
      console.warn("Failed to react comment:", error);
      setCommentReactionById((prev) => ({
        ...prev,
        [commentKey]: {
          likeState: nextLikeState,
          busy: false,
        },
      }));
      setCommentReactionMessage("评论互动失败，已尽量同步当前状态。");
      await refreshVisibleComment(token, articleTargetId, comment);
    }
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
    await loadComments(token, articleTargetId, commentPage + 1, true);
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
      const createdComment = await createComment(token, {
        target_type: "article",
        target_id: articleTargetId,
        content,
        meta: buildCommentMeta(currentUserProfile),
      });

      const optimisticComment: CommentItem = {
        id: createdComment.id,
        user_id: currentUserId ?? 0,
        content,
        root_id: 0,
        parent_id: 0,
        like_count: 0,
        dislike_count: 0,
        reply_count: 0,
        attribute: 0,
        state: 0,
        created_at: createdComment.created_at,
        meta: buildCommentMeta(currentUserProfile),
        children: [],
      };

      setCommentDraft("");
      setCommentPage(1);
      setComments((prev) =>
        prev.some((item) => toCommentIdKey(item.id) === toCommentIdKey(createdComment.id))
          ? prev
          : [optimisticComment, ...prev],
      );
      setCommentSubject((prev) => {
        if (!prev) {
          return {
            target_type: "article",
            target_id: articleTargetId,
            total_count: 1,
            root_count: 1,
            state: 0,
            attribute: 0,
            owner_id:
              article?.author_id !== undefined && article.author_id !== null
                ? String(article.author_id)
                : 0,
          };
        }

        return {
          ...prev,
          total_count: toNumber(prev.total_count, 0) + 1,
          root_count: toNumber(prev.root_count, 0) + 1,
        };
      });
      window.setTimeout(() => {
        void loadComments(token, articleTargetId, 1, false);
      }, 3000);
      setCommentSubmitMessage("评论已发布。");
    } catch (error) {
      setCommentSubmitMessage(error instanceof Error ? error.message : "评论发布失败，请稍后重试");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const ensureReplyThreadOpen = async (rootComment: CommentItem) => {
    if (!token) {
      router.push("/login");
      return false;
    }

    const rootKey = toCommentIdKey(rootComment.id);
    const currentState = replyStateByRootId[rootKey];
    if (currentState?.expanded && currentState.initialized) {
      return true;
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
      return true;
    }

    const initialReplies = Array.isArray(rootComment.children) ? rootComment.children : [];
    if (initialReplies.length > 0) {
      const replyCount = toNumber(rootComment.reply_count, initialReplies.length);
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
      return true;
    }

    await loadReplies(
      token,
      articleTargetId,
      rootComment.id,
      toNumber(rootComment.reply_count, 0),
      1,
      false,
    );
    return true;
  };

  const handleStartReply = async (rootComment: CommentItem, parentComment: CommentItem) => {
    if (!token) {
      router.push("/login");
      return;
    }

    const rootId = toRawCommentInteger(rootComment.id);
    const parentId = toRawCommentInteger(parentComment.id);
    if (!rootId || !parentId) {
      setCommentReactionMessage("当前评论暂不支持回复。");
      return;
    }

    const rootKey = toCommentIdKey(rootComment.id);
    const parentAuthor = getCommentAuthorView(parentComment, currentUserProfile);
    setReplyComposerByRootId((prev) => {
      const previous = prev[rootKey];
      const isSameParent = previous
        ? toCommentIdKey(previous.parentId) === toCommentIdKey(parentId)
        : false;
      return {
        ...prev,
        [rootKey]: {
          parentId,
          parentUserId: parentComment.user_id,
          parentUserName: parentAuthor.name,
          draft: isSameParent ? previous.draft : "",
          isSubmitting: false,
          error: null,
        },
      };
    });

    await ensureReplyThreadOpen(rootComment);
  };

  const handleCancelReply = (rootComment: CommentItem) => {
    const rootKey = toCommentIdKey(rootComment.id);
    setReplyComposerByRootId((prev) => {
      const next = { ...prev };
      delete next[rootKey];
      return next;
    });
  };

  const handleReplyDraftChange = (rootComment: CommentItem, value: string) => {
    const rootKey = toCommentIdKey(rootComment.id);
    setReplyComposerByRootId((prev) => {
      const previous = prev[rootKey];
      if (!previous) {
        return prev;
      }
      return {
        ...prev,
        [rootKey]: {
          ...previous,
          draft: value,
          error: null,
        },
      };
    });
  };

  const handleSubmitReply = async (rootComment: CommentItem) => {
    if (!token) {
      router.push("/login");
      return;
    }

    const rootKey = toCommentIdKey(rootComment.id);
    const composer = replyComposerByRootId[rootKey];
    if (!composer) {
      return;
    }

    const rootId = toRawCommentInteger(rootComment.id);
    const parentId = toRawCommentInteger(composer.parentId);
    if (!rootId || !parentId) {
      setReplyComposerByRootId((prev) => ({
        ...prev,
        [rootKey]: {
          ...composer,
          error: "当前评论暂不支持回复。",
        },
      }));
      return;
    }

    const content = composer.draft.trim();
    if (!content) {
      setReplyComposerByRootId((prev) => ({
        ...prev,
        [rootKey]: {
          ...composer,
          error: "请输入回复内容后再提交。",
        },
      }));
      return;
    }

    setReplyComposerByRootId((prev) => ({
      ...prev,
      [rootKey]: {
        ...composer,
        isSubmitting: true,
        error: null,
      },
    }));

    try {
      const createdReply = await createComment(token, {
        target_type: "article",
        target_id: articleTargetId,
        root_id: rootId,
        parent_id: parentId,
        content,
        meta: buildCommentMeta(currentUserProfile, {
          userId: composer.parentUserId,
          name: composer.parentUserName,
        }),
      });

      const optimisticReply: CommentItem = {
        id: createdReply.id,
        user_id: currentUserId ?? 0,
        content,
        root_id: rootId,
        parent_id: parentId,
        like_count: 0,
        dislike_count: 0,
        reply_count: 0,
        attribute: 0,
        state: 0,
        created_at: createdReply.created_at,
        meta: buildCommentMeta(currentUserProfile, {
          userId: composer.parentUserId,
          name: composer.parentUserName,
        }),
        children: [],
      };

      updateVisibleComment(rootComment.id, (item) => ({
        ...item,
        reply_count: toNumber(item.reply_count, 0) + 1,
      }));
      setCommentSubject((prev) =>
        prev
          ? {
              ...prev,
              total_count: toNumber(prev.total_count, 0) + 1,
            }
          : prev,
      );
      setReplyStateByRootId((prev) => {
        const prevState = prev[rootKey] ?? createEmptyReplyThreadState();
        const exists = prevState.items.some(
          (item) => toCommentIdKey(item.id) === toCommentIdKey(createdReply.id),
        );
        return {
          ...prev,
          [rootKey]: {
            ...prevState,
            expanded: true,
            initialized: true,
            items: exists ? prevState.items : [optimisticReply, ...prevState.items],
            page: Math.max(prevState.page, 1),
            hasMore: prevState.hasMore,
            isLoading: false,
            error: null,
          },
        };
      });
      setReplyComposerByRootId((prev) => ({
        ...prev,
        [rootKey]: {
          ...composer,
          draft: "",
          isSubmitting: false,
          error: null,
        },
      }));
      window.setTimeout(() => {
        void loadReplies(
          token,
          articleTargetId,
          rootComment.id,
          toNumber(rootComment.reply_count, 0) + 1,
          1,
          false,
        );
      }, 3000);
    } catch (error) {
      setReplyComposerByRootId((prev) => ({
        ...prev,
        [rootKey]: {
          ...composer,
          isSubmitting: false,
          error: error instanceof Error ? error.message : "回复发布失败，请稍后重试",
        },
      }));
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

    await loadReplies(
      token,
      articleTargetId,
      comment.id,
      toNumber(comment.reply_count, 0),
      1,
      false,
    );
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
      articleTargetId,
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
    await loadReplies(
      token,
      articleTargetId,
      comment.id,
      toNumber(comment.reply_count, 0),
      1,
      false,
    );
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
    targetId: articleTargetId,
    title,
    cover: cover || null,
  };

  return (
    <Layout>
      <PageContainer className="space-y-6 py-5 sm:space-y-8 sm:py-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard/recommend">返回推荐页</Link>
            </Button>
            {canEdit && (
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href={`/post/edit/${encodeURIComponent(articleId)}`}>去编辑</Link>
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              variant={favoriteItems.length > 0 ? "default" : "outline"}
              onClick={() => void handleToggleFavorite()}
              disabled={isFavoriteBusy}
              className="w-full sm:w-auto"
            >
              {isFavoriteBusy ? "处理中..." : favoriteItems.length > 0 ? "已收藏" : "收藏"}
            </Button>
            <Button
              id="article-like-button"
              variant={likeState === LIKE_STATE.LIKED ? "default" : "secondary"}
              onClick={handleLike}
              disabled={isReacting}
              aria-pressed={likeState === LIKE_STATE.LIKED}
              className="w-full sm:w-auto"
            >
              <ThumbsUpIcon className="size-4" />
              <span>赞</span>
              <span>{likeCount}</span>
            </Button>
            <Button
              id="article-dislike-button"
              variant={likeState === LIKE_STATE.DISLIKED ? "destructive" : "secondary"}
              onClick={handleDislike}
              disabled={isReacting}
              aria-pressed={likeState === LIKE_STATE.DISLIKED}
              className="w-full sm:w-auto"
            >
              <ThumbsDownIcon className="size-4" />
              <span>踩</span>
              <span>{dislikeCount}</span>
            </Button>
          </div>
        </div>

        {reactionMessage && <p className="text-destructive text-sm">{reactionMessage}</p>}
        {favoriteMessage && <p className="text-primary text-sm">{favoriteMessage}</p>}

        <article className="border-border bg-card/90 text-card-foreground space-y-5 rounded-[1.75rem] border p-4 shadow-sm backdrop-blur sm:p-6">
          <header className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{title}</h1>
            <p className="text-muted-foreground text-sm leading-6 break-words">
              作者：
              {authorSpaceHref ? (
                <Link
                  href={authorSpaceHref}
                  className="text-primary hover:text-primary/80 ml-1 font-medium underline-offset-4 transition hover:underline"
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
              <div className="border-border overflow-hidden rounded-[1.5rem] border">
                <Image
                  src={cover}
                  alt={title}
                  width={1200}
                  height={720}
                  priority
                  sizes="100vw"
                  className="max-h-[280px] w-full object-cover sm:max-h-[420px]"
                />
              </div>
            )}
          </header>

          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUpIcon className="size-4" />
              点赞：{likeCount}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ThumbsDownIcon className="size-4" />
              点踩：{dislikeCount}
            </span>
          </div>

          <section className="min-w-0 overflow-x-auto">
            <MarkdownArticle value={content} />
          </section>
        </article>

        <section className="border-border bg-card/90 text-card-foreground space-y-4 rounded-[1.75rem] border p-4 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <MessageCircleIcon className="size-5" />
                <span>评论{token && !commentError ? `（${rootCommentCount}）` : ""}</span>
              </h2>
              {token && !commentError && (
                <p className="text-muted-foreground text-xs leading-5">
                  总评论（含回复）：{totalCommentCount}
                </p>
              )}
            </div>
            <Button
              id="article-comment-submit"
              variant="outline"
              onClick={() => void handleSubmitComment()}
              disabled={!token || isSubmittingComment || !commentDraft.trim()}
              className="w-full sm:w-auto"
            >
              <MessageCircleIcon className="size-4" />
              {isSubmittingComment ? "发布中..." : "发布评论"}
            </Button>
          </div>

          {!token && <p className="text-muted-foreground text-sm">登录后可查看评论内容</p>}

          {token && (
            <div className="space-y-2">
              <label
                htmlFor="article-comment-draft"
                className="text-foreground text-sm font-medium"
              >
                写下你的评论
              </label>
              <textarea
                id="article-comment-draft"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                rows={4}
                className="border-input bg-background/70 text-foreground placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:ring-ring/20 min-h-[128px] w-full resize-y rounded-2xl border px-4 py-3 text-sm leading-6 transition outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60"
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
                      : "text-primary"
                  }`}
                >
                  {commentSubmitMessage}
                </p>
              )}
            </div>
          )}

          {commentReactionMessage && (
            <p id="comment-reaction-message" className="text-destructive text-sm">
              {commentReactionMessage}
            </p>
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
                const replyComposer = replyComposerByRootId[rootKey];
                const commentReaction =
                  commentReactionById[rootKey] ?? DEFAULT_COMMENT_REACTION_STATE;
                const commentAuthor = getCommentAuthorView(comment, currentUserProfile);
                const replyCount = toNumber(comment.reply_count, 0);
                const visibleReplyCount = Math.max(replyCount, replyState?.items.length ?? 0);
                const canToggleReplies = replyCount > 0 || Boolean(replyState?.initialized);

                return (
                  <div
                    key={rootKey}
                    className="border-border bg-background/65 space-y-3 rounded-2xl border px-3 py-3.5 shadow-sm sm:px-4"
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <ProfileAvatar
                        avatarUrl={commentAuthor.avatarUrl}
                        uid={commentAuthor.uid}
                        username={commentAuthor.name}
                        size="sm"
                        className="rounded-2xl ring-0"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-foreground truncate font-medium">
                            {commentAuthor.name}
                          </span>
                          <span className="text-muted-foreground">{comment.created_at}</span>
                        </div>
                        <p className="text-foreground text-sm leading-6 break-words">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <CommentReactionControls
                        comment={comment}
                        likeState={commentReaction.likeState}
                        isBusy={commentReaction.busy}
                        onLike={(item) => {
                          void handleCommentReaction(item, LIKE_STATE.LIKED);
                        }}
                        onDislike={(item) => {
                          void handleCommentReaction(item, LIKE_STATE.DISLIKED);
                        }}
                      />
                      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleStartReply(comment, comment)}
                          className="w-full sm:w-auto"
                        >
                          <MessageCircleIcon className="size-3.5" />
                          回复
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-stretch gap-2 sm:justify-end">
                      {canToggleReplies && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleToggleReplies(comment)}
                          disabled={replyState?.isLoading}
                          className="w-full sm:w-auto"
                        >
                          {replyState?.expanded
                            ? "收起回复"
                            : replyState?.initialized
                              ? `查看回复（${visibleReplyCount}）`
                              : "查看回复"}
                        </Button>
                      )}
                    </div>

                    {replyState?.expanded && (
                      <div className="border-primary/35 bg-muted/55 space-y-3 rounded-2xl border-l-2 px-3 py-3 sm:px-4">
                        {replyComposer && (
                          <div className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <label
                                htmlFor={`comment-${rootKey}-reply-draft`}
                                className="text-foreground text-sm font-medium"
                              >
                                回复{" "}
                                {replyComposer.parentUserName ||
                                  `用户 ${replyComposer.parentUserId}`}
                              </label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelReply(comment)}
                                disabled={replyComposer.isSubmitting}
                                className="w-full sm:w-auto"
                              >
                                取消
                              </Button>
                            </div>
                            <textarea
                              id={`comment-${rootKey}-reply-draft`}
                              value={replyComposer.draft}
                              onChange={(event) =>
                                handleReplyDraftChange(comment, event.target.value)
                              }
                              rows={3}
                              className="border-input bg-card/75 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20 min-h-[92px] w-full resize-y rounded-2xl border px-4 py-3 text-sm leading-6 transition outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60"
                              placeholder="写下你的回复"
                              disabled={replyComposer.isSubmitting}
                            />
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="min-h-5 text-sm">
                                {replyComposer.error && (
                                  <span className="text-destructive">{replyComposer.error}</span>
                                )}
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleSubmitReply(comment)}
                                disabled={replyComposer.isSubmitting || !replyComposer.draft.trim()}
                                className="w-full sm:w-auto"
                              >
                                {replyComposer.isSubmitting ? "回复中..." : "发布回复"}
                              </Button>
                            </div>
                          </div>
                        )}

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
                          const replyReaction =
                            commentReactionById[toCommentIdKey(reply.id)] ??
                            DEFAULT_COMMENT_REACTION_STATE;
                          const replyAuthor = getCommentAuthorView(reply, currentUserProfile);
                          const parentComment = findThreadCommentById(
                            reply.parent_id,
                            comment,
                            replyState.items,
                          );
                          const replyTargetName = getReplyTargetName(
                            reply,
                            parentComment,
                            currentUserProfile,
                          );
                          return (
                            <div
                              key={replyKey}
                              className="bg-card/80 space-y-2 rounded-xl px-3 py-2"
                            >
                              <div className="flex items-start gap-3">
                                <ProfileAvatar
                                  avatarUrl={replyAuthor.avatarUrl}
                                  uid={replyAuthor.uid}
                                  username={replyAuthor.name}
                                  size="sm"
                                  className="rounded-xl ring-0"
                                />
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-foreground truncate font-medium">
                                      {replyAuthor.name}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {reply.created_at}
                                    </span>
                                  </div>
                                  <div className="text-muted-foreground text-xs">
                                    回复{" "}
                                    <span className="text-foreground font-medium">
                                      {replyTargetName}
                                    </span>
                                  </div>
                                  <p className="text-foreground text-sm leading-6 break-words">
                                    {reply.content}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <CommentReactionControls
                                  comment={reply}
                                  likeState={replyReaction.likeState}
                                  isBusy={replyReaction.busy}
                                  onLike={(item) => {
                                    void handleCommentReaction(item, LIKE_STATE.LIKED);
                                  }}
                                  onDislike={(item) => {
                                    void handleCommentReaction(item, LIKE_STATE.DISLIKED);
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleStartReply(comment, reply)}
                                  className="w-full sm:w-auto"
                                >
                                  <MessageCircleIcon className="size-3.5" />
                                  回复
                                </Button>
                              </div>
                            </div>
                          );
                        })}

                        {replyState.hasMore && !replyState.error && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleLoadMoreReplies(comment)}
                            disabled={replyState.isLoading}
                            className="w-full sm:w-auto"
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
              className="w-full sm:w-auto"
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
