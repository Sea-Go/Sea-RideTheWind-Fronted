"use client";

import { useEffect, useMemo, useState } from "react";

import { type ArticleItem, getArticle, listArticles } from "@/services/article";
import { getAuthToken, getUserProfile } from "@/services/auth";
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
import { recommendArticles, searchReco } from "@/services/reco";
import type { DashboardPost } from "@/types";

import { Card } from "./Card";

const FALLBACK_TITLE = "\u672a\u547d\u540d\u6587\u7ae0";
const FALLBACK_AUTHOR = "\u533f\u540d\u7528\u6237";
const FALLBACK_CONTENT = "\u6682\u65e0\u6458\u8981";
const INVALID_ID_PREFIX = "article-";
const SEARCH_TOP_K = 20;
const SEARCH_SESSION_STORAGE_KEY = "dashboard_search_session_id";

interface LikeMeta {
  likeCount: number;
  dislikeCount: number;
  likeState: LikeState;
  busy: boolean;
}

interface CardListProps {
  query?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const pickFirstArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const arrayKeys = ["list", "articles", "items", "records", "rows", "hits"] as const;
  for (const key of arrayKeys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (record.data) {
    return pickFirstArray(record.data);
  }

  return [];
};

const pickArticleId = (item: ArticleItem, fallbackIndex: number): string => {
  const candidates = [item.id, item.article_id];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }
  return `${INVALID_ID_PREFIX}${fallbackIndex}`;
};

const toDashboardPost = (item: ArticleItem, index: number): DashboardPost => {
  const title =
    (typeof item.title === "string" && item.title.trim()) ||
    (typeof item.brief === "string" && item.brief.trim()) ||
    FALLBACK_TITLE;
  const content =
    (typeof item.brief === "string" && item.brief.trim()) ||
    (typeof item.content === "string" && item.content.trim()) ||
    FALLBACK_CONTENT;
  const image =
    (typeof item.cover_image_url === "string" && item.cover_image_url.trim()) ||
    (typeof item.cover === "string" && item.cover.trim()) ||
    null;
  const author =
    (typeof item.author_name === "string" && item.author_name.trim()) ||
    (typeof item.username === "string" && item.username.trim()) ||
    FALLBACK_AUTHOR;
  const likes =
    typeof item.like_count === "number"
      ? item.like_count
      : typeof item.likes === "number"
        ? item.likes
        : 0;
  const publishedAt =
    (typeof item.create_time === "string" && item.create_time) ||
    (typeof item.created_at === "string" && item.created_at) ||
    (typeof item.published_at === "string" && item.published_at) ||
    "";

  return {
    id: pickArticleId(item, index),
    title,
    content,
    image,
    author,
    likes,
    publishedAt,
  };
};

const extractRecoArticleIds = (payload: unknown): string[] => {
  const items = pickFirstArray(payload);
  if (!items.length) {
    return [];
  }

  return items
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return "";
      }

      const candidate = record.article_id ?? record.id ?? record.target_id;
      return candidate === undefined || candidate === null ? "" : String(candidate).trim();
    })
    .filter((id): id is string => Boolean(id));
};

const collectIdCandidates = (record: Record<string, unknown>): unknown[] => {
  const values: unknown[] = [record.article_id, record.id, record.target_id, record.articleId];
  const nestedKeys = ["doc", "article", "source", "payload", "item", "data", "hit"] as const;

  for (const key of nestedKeys) {
    const nestedRecord = asRecord(record[key]);
    if (!nestedRecord) {
      continue;
    }
    values.push(
      nestedRecord.article_id,
      nestedRecord.id,
      nestedRecord.target_id,
      nestedRecord.articleId,
    );
  }

  return values;
};

const extractSearchItems = (payload: unknown): Record<string, unknown>[] => {
  const payloadRecord = asRecord(payload);
  if (!payloadRecord) {
    return [];
  }

  const dataRecord = asRecord(payloadRecord.data) ?? payloadRecord;
  const rawItems = pickFirstArray(dataRecord.items ?? dataRecord.hits ?? dataRecord.list);
  if (!rawItems.length) {
    return [];
  }

  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    const itemRecord = asRecord(item);
    if (!itemRecord) {
      continue;
    }

    const articleId = collectIdCandidates(itemRecord)
      .map((value) => (value === undefined || value === null ? "" : String(value).trim()))
      .find((value) => Boolean(value));
    const chunkId =
      (typeof itemRecord.chunk_id === "string" && itemRecord.chunk_id.trim()) ||
      (typeof itemRecord.chunkId === "string" && itemRecord.chunkId.trim()) ||
      "";
    const key = articleId ? `article:${articleId}` : chunkId ? `chunk:${chunkId}` : "";
    if (key && seen.has(key)) {
      continue;
    }

    if (key) {
      seen.add(key);
    }
    items.push(itemRecord);
  }

  return items;
};

const pickSearchItemArticleId = (item: Record<string, unknown>): string => {
  return (
    collectIdCandidates(item)
      .map((value) => (value === undefined || value === null ? "" : String(value).trim()))
      .find((value) => Boolean(value)) ?? ""
  );
};

const canFetchArticleDetail = (articleId: string): boolean => {
  if (!articleId) {
    return false;
  }

  return !articleId.startsWith("art_") && !articleId.startsWith("chk_");
};

const toSearchFallbackPost = (
  item: Record<string, unknown>,
  index: number,
  rawArticleId: string,
): DashboardPost => {
  const title =
    (typeof item.title === "string" && item.title.trim()) ||
    (typeof item.h2 === "string" && item.h2.trim()) ||
    FALLBACK_TITLE;
  const content =
    (typeof item.snippet === "string" && item.snippet.trim()) ||
    (typeof item.h2 === "string" && item.h2.trim()) ||
    FALLBACK_CONTENT;
  const image =
    (typeof item.cover_image_url === "string" && item.cover_image_url.trim()) ||
    (typeof item.cover === "string" && item.cover.trim()) ||
    null;
  const author =
    (typeof item.author_name === "string" && item.author_name.trim()) ||
    (typeof item.author === "string" && item.author.trim()) ||
    FALLBACK_AUTHOR;
  const publishedAt =
    typeof item.create_time === "number"
      ? String(item.create_time)
      : typeof item.create_time === "string"
        ? item.create_time
        : "";
  const safeIdPart = rawArticleId || String(index);

  return {
    id: `${INVALID_ID_PREFIX}search-${safeIdPart}`,
    title,
    content,
    image,
    author,
    likes: 0,
    publishedAt,
  };
};

const createSearchRequestId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `search_${Date.now()}_${randomPart}`;
};

const createSessionId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getOrCreateSearchSessionId = (): string => {
  if (typeof window === "undefined") {
    return "dashboard-server-session";
  }

  try {
    const current = window.sessionStorage.getItem(SEARCH_SESSION_STORAGE_KEY);
    if (current) {
      return current;
    }

    const next = createSessionId();
    window.sessionStorage.setItem(SEARCH_SESSION_STORAGE_KEY, next);
    return next;
  } catch (error) {
    console.warn("Failed to access sessionStorage for dashboard search:", error);
    return createSessionId();
  }
};

const pickArticleFromPayload = (payload: unknown): ArticleItem | null => {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const candidates = [record.article, record.item, record.data, record] as unknown[];
  for (const candidate of candidates) {
    const candidateRecord = asRecord(candidate);
    if (!candidateRecord) {
      continue;
    }

    const nestedArticle = asRecord(candidateRecord.article);
    if (nestedArticle) {
      return nestedArticle as ArticleItem;
    }

    const looksLikeArticle = ["id", "article_id", "title", "brief", "content", "author_id"].some(
      (key) => Object.hasOwn(candidateRecord, key),
    );
    if (looksLikeArticle) {
      return candidateRecord as ArticleItem;
    }
  }

  return null;
};

export const CardList = ({ query = "" }: CardListProps) => {
  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const isSearchMode = normalizedQuery.length > 0;
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [likeMetaMap, setLikeMetaMap] = useState<Record<string, LikeMeta>>({});
  const [authorIdMap, setAuthorIdMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        setFetchErrorMessage(null);
        setActionMessage(null);
        setLikeMetaMap({});
        setAuthorIdMap({});

        const currentToken = getAuthToken();
        setToken(currentToken);

        let finalPosts: DashboardPost[] = [];
        let nextAuthorIdMap: Record<string, string> = {};

        if (normalizedQuery) {
          const sessionId = getOrCreateSearchSessionId();
          let searchUserId = `guest:${sessionId}`;

          if (currentToken) {
            try {
              const profile = await getUserProfile(currentToken);
              if (profile.user.uid?.trim()) {
                searchUserId = profile.user.uid.trim();
              }
            } catch (error) {
              console.warn("Search fallback to guest user_id:", error);
            }
          }

          const searchPayload = await searchReco({
            request_id: createSearchRequestId(),
            user_id: searchUserId,
            session_id: sessionId,
            query: normalizedQuery,
            top_k: SEARCH_TOP_K,
            need_answer: false,
            explain: false,
          });
          const searchItems = extractSearchItems(searchPayload);

          if (!searchItems.length) {
            setPosts([]);
            return;
          }

          finalPosts = [];
          nextAuthorIdMap = {};

          const resolvedPosts = await Promise.all(
            searchItems.map(async (item, index) => {
              const articleId = pickSearchItemArticleId(item);

              if (canFetchArticleDetail(articleId)) {
                try {
                  const articlePayload = await getArticle(articleId, {
                    token: currentToken ?? undefined,
                    incr_view: false,
                  });
                  const article = pickArticleFromPayload(articlePayload);
                  if (article) {
                    const normalizedArticle: ArticleItem = {
                      ...article,
                      id: article.id ?? article.article_id ?? articleId,
                      article_id: article.article_id ?? article.id ?? articleId,
                    };
                    const post = toDashboardPost(normalizedArticle, index);
                    const authorId = article.author_id;
                    if (authorId !== undefined && authorId !== null && String(authorId).trim()) {
                      nextAuthorIdMap[post.id] = String(authorId).trim();
                    }
                    return post;
                  }
                } catch (error) {
                  console.warn(`Failed to load search article detail: ${articleId}`, error);
                }
              }

              return toSearchFallbackPost(item, index, articleId);
            }),
          );

          finalPosts = resolvedPosts;

          setPosts(finalPosts);
          setAuthorIdMap(nextAuthorIdMap);

          if (!finalPosts.length) {
            setFetchErrorMessage(
              "\u641c\u7d22\u7ed3\u679c\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
            );
            return;
          }
        } else {
          let recoIds: string[] = [];
          if (currentToken) {
            try {
              const profile = await getUserProfile(currentToken);
              const recoPayload = await recommendArticles({
                user_id: profile.user.uid,
                surface: "dashboard_recommend",
              });
              recoIds = extractRecoArticleIds(recoPayload);
            } catch (error) {
              console.warn("Recommend fallback to articles list:", error);
            }
          }

          const articlesPayload = await listArticles({
            page: 1,
            page_size: 20,
            sort_by: "create_time",
            desc: true,
          });

          const articleItems = pickFirstArray(articlesPayload)
            .map((item) => asRecord(item))
            .filter((item): item is ArticleItem => Boolean(item));

          nextAuthorIdMap = {};
          const normalizedPosts = articleItems.map((item, index) => {
            const post = toDashboardPost(item, index);
            const authorId = item.author_id;
            if (authorId !== undefined && authorId !== null && String(authorId).trim()) {
              nextAuthorIdMap[post.id] = String(authorId).trim();
            }
            return post;
          });

          if (!normalizedPosts.length) {
            setPosts([]);
            return;
          }

          finalPosts = normalizedPosts;
          if (recoIds.length) {
            const postMap = new Map(normalizedPosts.map((post) => [post.id, post]));
            const recoOrderedPosts = recoIds
              .map((id) => postMap.get(id))
              .filter(Boolean) as DashboardPost[];
            const restPosts = normalizedPosts.filter((post) => !recoIds.includes(post.id));
            finalPosts = [...recoOrderedPosts, ...restPosts];
          }

          setPosts(finalPosts);
          setAuthorIdMap(nextAuthorIdMap);
        }

        if (!currentToken || !finalPosts.length) {
          return;
        }

        const validIds = finalPosts
          .map((post) => post.id)
          .filter((id) => !id.startsWith(INVALID_ID_PREFIX));
        if (!validIds.length) {
          return;
        }

        try {
          const [counts, states] = await Promise.all([
            getLikeCount(currentToken, {
              target_type: "article",
              target_ids: validIds,
            }),
            getLikeState(currentToken, {
              target_type: "article",
              target_ids: validIds,
            }),
          ]);

          const nextMetaMap: Record<string, LikeMeta> = {};
          for (const post of finalPosts) {
            const countItem = counts.counts?.[post.id];
            nextMetaMap[post.id] = {
              likeCount: toNumber(countItem?.like_count, post.likes),
              dislikeCount: toNumber(countItem?.dislike_count, 0),
              likeState: toLikeState(states.states?.[post.id], LIKE_STATE.NONE),
              busy: false,
            };
          }
          setLikeMetaMap(nextMetaMap);
        } catch (error) {
          console.warn("Failed to load like states in dashboard:", error);
        }
      } catch (error) {
        console.warn("Failed to load dashboard posts:", error);
        setFetchErrorMessage(
          normalizedQuery
            ? "\u641c\u7d22\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5"
            : "\u63a8\u8350\u5185\u5bb9\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5",
        );
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPosts();
  }, [normalizedQuery]);

  const getCurrentMeta = (postId: string): LikeMeta => {
    const cachedMeta = likeMetaMap[postId];
    if (cachedMeta) {
      return cachedMeta;
    }

    const fallbackLikeCount = posts.find((post) => post.id === postId)?.likes ?? 0;
    return {
      likeCount: fallbackLikeCount,
      dislikeCount: 0,
      likeState: LIKE_STATE.NONE,
      busy: false,
    };
  };

  const syncPostReaction = async (postId: string, fallbackMeta: LikeMeta): Promise<boolean> => {
    if (!token) {
      return false;
    }

    try {
      const [counts, states] = await Promise.all([
        getLikeCount(token, {
          target_type: "article",
          target_ids: [postId],
        }),
        getLikeState(token, {
          target_type: "article",
          target_ids: [postId],
        }),
      ]);

      const countItem = counts.counts?.[postId];
      setLikeMetaMap((prev) => ({
        ...prev,
        [postId]: {
          likeCount: toNumber(countItem?.like_count, fallbackMeta.likeCount),
          dislikeCount: toNumber(countItem?.dislike_count, fallbackMeta.dislikeCount),
          likeState: toLikeState(states.states?.[postId], fallbackMeta.likeState),
          busy: false,
        },
      }));
      return true;
    } catch (error) {
      console.warn("Failed to resync post reaction state:", error);
      return false;
    }
  };

  const handleReaction = async (postId: string, targetState: ReactionTarget) => {
    if (!token) {
      setActionMessage("\u8bf7\u5148\u767b\u5f55\u540e\u518d\u4e92\u52a8");
      return;
    }

    if (postId.startsWith(INVALID_ID_PREFIX)) {
      setActionMessage("\u5f53\u524d\u6587\u7ae0\u6682\u4e0d\u652f\u6301\u70b9\u8d5e/\u70b9\u8e29");
      return;
    }

    const currentMeta = getCurrentMeta(postId);
    if (currentMeta.busy) {
      return;
    }

    const steps = buildReactionSteps(currentMeta.likeState, targetState);
    const finalState = resolveReactionFinalState(currentMeta.likeState, targetState);

    setActionMessage(null);
    setLikeMetaMap((prev) => ({
      ...prev,
      [postId]: {
        ...currentMeta,
        busy: true,
      },
    }));

    let nextLikeCount = currentMeta.likeCount;
    let nextDislikeCount = currentMeta.dislikeCount;
    let nextLikeState = currentMeta.likeState;

    try {
      for (const step of steps) {
        const result = await likeAction(token, {
          target_type: "article",
          target_id: postId,
          action_type: step,
          author_id: authorIdMap[postId],
          weight: 1,
        });

        nextLikeCount = toNumber(result.like_count, nextLikeCount);
        nextDislikeCount = toNumber(result.dislike_count, nextDislikeCount);
        nextLikeState = applyReactionStep(nextLikeState, step);

        setLikeMetaMap((prev) => ({
          ...prev,
          [postId]: {
            likeCount: nextLikeCount,
            dislikeCount: nextDislikeCount,
            likeState: nextLikeState,
            busy: true,
          },
        }));
      }

      setLikeMetaMap((prev) => ({
        ...prev,
        [postId]: {
          likeCount: nextLikeCount,
          dislikeCount: nextDislikeCount,
          likeState: finalState,
          busy: false,
        },
      }));
    } catch (error) {
      console.warn("Failed to react post:", error);
      const synced = await syncPostReaction(postId, currentMeta);
      if (!synced) {
        setLikeMetaMap((prev) => ({
          ...prev,
          [postId]: {
            ...currentMeta,
            busy: false,
          },
        }));
      }
      setActionMessage("\u64cd\u4f5c\u5931\u8d25\uff0c\u5df2\u540c\u6b65\u6700\u65b0\u72b6\u6001");
    }
  };

  const handleLike = async (postId: string) => {
    await handleReaction(postId, LIKE_STATE.LIKED);
  };

  const handleDislike = async (postId: string) => {
    await handleReaction(postId, LIKE_STATE.DISLIKED);
  };

  if (isLoading) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        {"\u6587\u7ae0\u52a0\u8f7d\u4e2d..."}
      </p>
    );
  }

  if (fetchErrorMessage) {
    return <p className="text-destructive py-8 text-center">{fetchErrorMessage}</p>;
  }

  if (!posts.length) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        {isSearchMode
          ? "\u672a\u641c\u7d22\u5230\u76f8\u5173\u5185\u5bb9"
          : "\u6682\u65e0\u6587\u7ae0\uff0c\u5feb\u53bb\u53d1\u5e03\u7b2c\u4e00\u7bc7\u5427\u3002"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {actionMessage && <p className="text-destructive text-sm">{actionMessage}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {posts.map((post) => {
          const meta = likeMetaMap[post.id];
          return (
            <Card
              key={post.id}
              {...post}
              likeCount={meta?.likeCount ?? post.likes}
              dislikeCount={meta?.dislikeCount ?? 0}
              isLiked={meta?.likeState === LIKE_STATE.LIKED}
              isDisliked={meta?.likeState === LIKE_STATE.DISLIKED}
              actionDisabled={meta?.busy}
              onLike={handleLike}
              onDislike={handleDislike}
            />
          );
        })}
      </div>
    </div>
  );
};
