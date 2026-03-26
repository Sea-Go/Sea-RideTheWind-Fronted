"use client";

import { RefreshCcwIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_DASHBOARD_TAB,
  buildDashboardTabSearchText,
  type DashboardTabSlug,
} from "@/app/dashboard/_constants/tabs";
import { FavoritePickerDialog } from "@/components/favorite/FavoritePickerDialog";
import { Button } from "@/components/ui/button";
import { type ArticleItem, getArticle } from "@/services/article";
import { getAuthToken, getUserProfile } from "@/services/auth";
import { deleteFavoriteItems, loadFavoriteInventory } from "@/services/favorite";
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
import { searchReco } from "@/services/reco";
import {
  buildGuestRecoUserId,
  buildUserRecoKey,
  fetchRecommendSnapshot,
  getOrCreateRecoSessionId,
  readRecommendSnapshotCache,
  readRecommendViewCache,
  saveRecommendViewCache,
  type RecommendSnapshot,
} from "@/services/reco-snapshot";
import type { DashboardPost } from "@/types";

import { Card } from "./Card";

const FALLBACK_TITLE = "\u672a\u547d\u540d\u6587\u7ae0";
const FALLBACK_AUTHOR = "\u672a\u77e5\u4f5c\u8005";
const FALLBACK_CONTENT = "\u6682\u65e0\u6458\u8981";
const INVALID_ID_PREFIX = "article-";
const SEARCH_TOP_K = 20;
const SEARCH_SESSION_STORAGE_KEY = "dashboard_search_session_id";

const createEmptyFavoriteMeta = (): FavoriteMeta => ({
  favorited: false,
  favoriteIds: [],
  busy: false,
});

interface LikeMeta {
  likeCount: number;
  dislikeCount: number;
  likeState: LikeState;
  busy: boolean;
}

interface FavoriteMeta {
  favorited: boolean;
  favoriteIds: string[];
  busy: boolean;
}

interface CardListProps {
  query?: string;
  tabSlug?: DashboardTabSlug;
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

const resolveAuthorText = (item: ArticleItem): string => {
  if (typeof item.author_name === "string" && item.author_name.trim()) {
    return item.author_name.trim();
  }
  if (typeof item.username === "string" && item.username.trim()) {
    return item.username.trim();
  }
  if (item.author_id !== undefined && item.author_id !== null && String(item.author_id).trim()) {
    return `用户 ${String(item.author_id).trim()}`;
  }
  return FALLBACK_AUTHOR;
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
  const author = resolveAuthorText(item);
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

const toRecommendSnapshotPosts = (snapshot: RecommendSnapshot): DashboardPost[] =>
  snapshot.ids.map((id, index) => toRecommendFallbackPost(id, index, snapshot.explanation ?? ""));

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
    (rawArticleId ? `用户 ${rawArticleId}` : FALLBACK_AUTHOR);
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

const toRecommendFallbackPost = (
  recoId: string,
  index: number,
  explanation: string,
): DashboardPost => {
  const safeId = recoId.trim() || `${INVALID_ID_PREFIX}reco-${index}`;
  const idSuffix = safeId.length > 8 ? safeId.slice(-8) : safeId;
  const description = explanation || `推荐编号: ${idSuffix}`;
  return {
    id: safeId,
    title: `推荐结果 ${index + 1}`,
    content: description || FALLBACK_CONTENT,
    image: null,
    author: FALLBACK_AUTHOR,
    likes: 0,
    publishedAt: "",
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

const resolveRecommendPosts = async (
  snapshot: RecommendSnapshot,
  token: string | null,
): Promise<{ posts: DashboardPost[]; authorIdMap: Record<string, string> }> => {
  const resolvedEntries = await Promise.all(
    snapshot.ids.map(async (articleId, index) => {
      if (canFetchArticleDetail(articleId)) {
        try {
          const articlePayload = await getArticle(articleId, {
            token: token ?? undefined,
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
            return {
              post,
              authorId:
                authorId !== undefined && authorId !== null && String(authorId).trim()
                  ? String(authorId).trim()
                  : null,
            };
          }
        } catch (error) {
          console.warn(`Failed to hydrate recommend article: ${articleId}`, error);
        }
      }

      return null;
    }),
  );

  const hydratedPosts: DashboardPost[] = [];
  const nextAuthorIdMap: Record<string, string> = {};

  for (const entry of resolvedEntries) {
    if (!entry) {
      continue;
    }

    hydratedPosts.push(entry.post);
    if (entry.authorId) {
      nextAuthorIdMap[entry.post.id] = entry.authorId;
    }
  }

  if (hydratedPosts.length > 0) {
    return { posts: hydratedPosts, authorIdMap: nextAuthorIdMap };
  }

  return {
    posts: snapshot.ids.map((articleId, index) =>
      toRecommendFallbackPost(articleId, index, snapshot.explanation ?? ""),
    ),
    authorIdMap: {},
  };
};

export const CardList = ({ query = "", tabSlug = DEFAULT_DASHBOARD_TAB }: CardListProps) => {
  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const presetTabQuery = useMemo(() => {
    if (tabSlug === DEFAULT_DASHBOARD_TAB || normalizedQuery) {
      return "";
    }
    return buildDashboardTabSearchText(tabSlug).trim();
  }, [normalizedQuery, tabSlug]);
  const effectiveQuery = useMemo(
    () => (normalizedQuery || presetTabQuery).trim(),
    [normalizedQuery, presetTabQuery],
  );
  const isSearchMode = effectiveQuery.length > 0;
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [likeMetaMap, setLikeMetaMap] = useState<Record<string, LikeMeta>>({});
  const [favoriteMetaMap, setFavoriteMetaMap] = useState<Record<string, FavoriteMeta>>({});
  const [authorIdMap, setAuthorIdMap] = useState<Record<string, string>>({});
  const [favoriteDialogPost, setFavoriteDialogPost] = useState<Pick<
    DashboardPost,
    "id" | "title" | "image"
  > | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [refreshFeedbackTick, setRefreshFeedbackTick] = useState(0);
  const [showRefreshFeedback, setShowRefreshFeedback] = useState(false);
  const handledRefreshNonceRef = useRef(0);

  useEffect(() => {
    if (!refreshFeedbackTick) {
      return;
    }

    setShowRefreshFeedback(true);
    const timer = window.setTimeout(() => {
      setShowRefreshFeedback(false);
    }, 1100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refreshFeedbackTick]);

  const loadLikeStates = useCallback(
    async (currentToken: string, targetPosts: DashboardPost[]): Promise<void> => {
      const validIds = targetPosts
        .map((post) => post.id)
        .filter((id) => !id.startsWith(INVALID_ID_PREFIX) && canFetchArticleDetail(id));
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
        for (const post of targetPosts) {
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
    },
    [],
  );

  const loadFavoriteStates = useCallback(
    async (currentToken: string, targetPosts: DashboardPost[]): Promise<void> => {
      const validIds = targetPosts
        .map((post) => post.id)
        .filter((id) => !id.startsWith(INVALID_ID_PREFIX) && canFetchArticleDetail(id));
      if (!validIds.length) {
        setFavoriteMetaMap({});
        return;
      }

      try {
        const inventory = await loadFavoriteInventory(currentToken);
        const nextMetaMap: Record<string, FavoriteMeta> = {};

        for (const post of targetPosts) {
          const favorites = inventory.articleMap[post.id] ?? [];
          nextMetaMap[post.id] = {
            favorited: favorites.length > 0,
            favoriteIds: favorites.map((favorite) => favorite.favoriteId).filter(Boolean),
            busy: false,
          };
        }

        setFavoriteMetaMap(nextMetaMap);
      } catch (error) {
        console.warn("Failed to load favorite states in dashboard:", error);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let disposeRecommendListeners: (() => void) | null = null;
    const isManualRecommendRefresh = !isSearchMode && refreshNonce > handledRefreshNonceRef.current;
    handledRefreshNonceRef.current = refreshNonce;

    const fetchPosts = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setFetchErrorMessage(null);
        setActionMessage(null);
        setLikeMetaMap({});
        setFavoriteMetaMap({});
        setAuthorIdMap({});

        const currentToken = getAuthToken();
        setToken(currentToken);

        if (effectiveQuery) {
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
            query: effectiveQuery,
            top_k: SEARCH_TOP_K,
            need_answer: false,
            explain: false,
          });
          const searchItems = extractSearchItems(searchPayload);

          if (!searchItems.length) {
            if (cancelled) {
              return;
            }
            setPosts([]);
            setAuthorIdMap({});
            setIsLoading(false);
            return;
          }

          let finalPosts: DashboardPost[] = [];
          let nextAuthorIdMap: Record<string, string> = {};

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
          if (cancelled) {
            return;
          }
          setPosts(finalPosts);
          setAuthorIdMap(nextAuthorIdMap);
          setIsLoading(false);

          if (!finalPosts.length) {
            setFetchErrorMessage(
              "\u641c\u7d22\u7ed3\u679c\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
            );
            return;
          }

          if (currentToken) {
            void loadLikeStates(currentToken, finalPosts);
            void loadFavoriteStates(currentToken, finalPosts);
          }
          return;
        }

        const sessionId = getOrCreateRecoSessionId();
        const guestUserId = buildGuestRecoUserId(sessionId);
        const guestUserKey = buildUserRecoKey(guestUserId);
        let currentPriority = 0;
        const RECOMMEND_PRIORITY = {
          guestCachedSnapshotFallback: 10,
          guestCachedResolved: 20,
          guestLiveSnapshotFallback: 25,
          guestLiveResolved: 30,
          userCachedSnapshotFallback: 40,
          userCachedResolved: 50,
          userLiveSnapshotFallback: 55,
          userLiveResolved: 60,
        } as const;

        let recommendSnapshotSeq = 0;

        const applyRecommendViewCache = (userKey: string, priority: number): void => {
          const cachedView = readRecommendViewCache(userKey).view;
          if (cancelled || !cachedView || !cachedView.posts.length || priority < currentPriority) {
            return;
          }

          currentPriority = priority;
          setPosts(cachedView.posts);
          setAuthorIdMap(cachedView.authorIdMap);
          setFetchErrorMessage(null);
          setIsLoading(false);
          if (currentToken) {
            void loadLikeStates(currentToken, cachedView.posts);
            void loadFavoriteStates(currentToken, cachedView.posts);
          }
        };

        const applyRecommendSnapshot = (
          snapshot: RecommendSnapshot | null,
          fallbackPriority: number,
          resolvedPriority: number,
        ): void => {
          if (cancelled || !snapshot || !snapshot.ids.length) {
            return;
          }

          const snapshotSeq = ++recommendSnapshotSeq;
          if (fallbackPriority >= currentPriority) {
            currentPriority = fallbackPriority;
            const fallbackPosts = toRecommendSnapshotPosts(snapshot);
            setPosts(fallbackPosts);
            setAuthorIdMap({});
            setFetchErrorMessage(null);
            setIsLoading(false);
            if (currentToken) {
              void loadLikeStates(currentToken, fallbackPosts);
              void loadFavoriteStates(currentToken, fallbackPosts);
            }
          }

          void (async () => {
            const resolved = await resolveRecommendPosts(snapshot, currentToken);
            if (
              cancelled ||
              snapshotSeq !== recommendSnapshotSeq ||
              resolvedPriority < currentPriority
            ) {
              return;
            }

            currentPriority = resolvedPriority;
            setPosts(resolved.posts);
            setAuthorIdMap(resolved.authorIdMap);
            setFetchErrorMessage(null);
            setIsLoading(false);
            if (currentToken) {
              void loadLikeStates(currentToken, resolved.posts);
              void loadFavoriteStates(currentToken, resolved.posts);
            }

            const hasRenderablePosts = resolved.posts.some(
              (post) => !post.id.startsWith(INVALID_ID_PREFIX) && canFetchArticleDetail(post.id),
            );
            if (hasRenderablePosts) {
              saveRecommendViewCache(snapshot, resolved.posts, resolved.authorIdMap);
            }
          })();
        };

        const applyEmptyRecommendState = (): void => {
          if (cancelled || currentPriority > 0) {
            return;
          }

          setPosts([]);
          setAuthorIdMap({});
          setIsLoading(false);
        };

        const refreshGuestRecommend = async (): Promise<void> => {
          try {
            const snapshot = await fetchRecommendSnapshot(
              {
                userId: guestUserId,
                userKey: guestUserKey,
                sessionId,
                surface: "dashboard_recommend",
                query: "",
                periodBucket: "d1",
              },
              {
                force: isManualRecommendRefresh,
              },
            );
            applyRecommendSnapshot(
              snapshot,
              RECOMMEND_PRIORITY.guestLiveSnapshotFallback,
              RECOMMEND_PRIORITY.guestLiveResolved,
            );
            if (!snapshot?.ids.length) {
              applyEmptyRecommendState();
            }
          } catch (error) {
            console.warn("Failed to refresh guest recommend snapshot:", error);
            if (currentPriority === 0 && !cancelled) {
              setFetchErrorMessage(
                "\u63a8\u8350\u5185\u5bb9\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5",
              );
              setPosts([]);
              setAuthorIdMap({});
              setIsLoading(false);
            }
          }
        };

        let resolvedUserId: string | null = null;
        let resolvingUserId: Promise<string | null> | null = null;
        const resolveUserId = async (): Promise<string | null> => {
          if (!currentToken) {
            return null;
          }

          if (resolvedUserId) {
            return resolvedUserId;
          }

          if (resolvingUserId) {
            return resolvingUserId;
          }

          resolvingUserId = (async () => {
            try {
              const profile = await getUserProfile(currentToken);
              const uid = profile.user.uid?.trim();
              resolvedUserId = uid || null;
              return resolvedUserId;
            } catch (error) {
              console.warn("Recommend fallback to guest user_id:", error);
              resolvedUserId = null;
              return null;
            } finally {
              resolvingUserId = null;
            }
          })();
          return resolvingUserId;
        };

        const refreshUserRecommend = async (): Promise<void> => {
          const uid = await resolveUserId();
          if (!uid || cancelled) {
            return;
          }

          const userKey = buildUserRecoKey(uid);
          if (!isManualRecommendRefresh) {
            applyRecommendViewCache(userKey, RECOMMEND_PRIORITY.userCachedResolved);

            const userCached = readRecommendSnapshotCache(userKey);
            applyRecommendSnapshot(
              userCached.snapshot,
              RECOMMEND_PRIORITY.userCachedSnapshotFallback,
              RECOMMEND_PRIORITY.userCachedResolved,
            );
          }

          try {
            const snapshot = await fetchRecommendSnapshot(
              {
                userId: uid,
                userKey,
                sessionId,
                surface: "dashboard_recommend",
                query: "",
                periodBucket: "d1",
              },
              {
                force: isManualRecommendRefresh,
              },
            );
            applyRecommendSnapshot(
              snapshot,
              RECOMMEND_PRIORITY.userLiveSnapshotFallback,
              RECOMMEND_PRIORITY.userLiveResolved,
            );
          } catch (error) {
            console.warn("Failed to refresh user recommend snapshot:", error);
          }
        };

        if (!isManualRecommendRefresh) {
          applyRecommendViewCache(guestUserKey, RECOMMEND_PRIORITY.guestCachedResolved);
          const guestCached = readRecommendSnapshotCache(guestUserKey);
          applyRecommendSnapshot(
            guestCached.snapshot,
            RECOMMEND_PRIORITY.guestCachedSnapshotFallback,
            RECOMMEND_PRIORITY.guestCachedResolved,
          );
        }

        const triggerRecommendRefresh = (): void => {
          void refreshGuestRecommend();
          if (currentToken) {
            void refreshUserRecommend();
          }
        };

        triggerRecommendRefresh();

        const handleVisibilityChange = (): void => {
          if (document.visibilityState !== "visible") {
            return;
          }
          triggerRecommendRefresh();
        };
        const handleOnline = (): void => {
          triggerRecommendRefresh();
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("online", handleOnline);
        disposeRecommendListeners = () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          window.removeEventListener("online", handleOnline);
        };
      } catch (error) {
        console.warn("Failed to load dashboard posts:", error);
        if (cancelled) {
          return;
        }
        setFetchErrorMessage(
          normalizedQuery
            ? "\u641c\u7d22\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5"
            : effectiveQuery
              ? "\u5206\u533a\u5185\u5bb9\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5"
              : "\u63a8\u8350\u5185\u5bb9\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5",
        );
        setPosts([]);
        setIsLoading(false);
      }
    };

    void fetchPosts();

    return () => {
      cancelled = true;
      if (disposeRecommendListeners) {
        disposeRecommendListeners();
      }
    };
  }, [effectiveQuery, loadFavoriteStates, loadLikeStates, normalizedQuery, refreshNonce]);

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

    if (postId.startsWith(INVALID_ID_PREFIX) || !canFetchArticleDetail(postId)) {
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

  const handleFavorite = async (post: Pick<DashboardPost, "id" | "title" | "image">) => {
    if (!token) {
      setActionMessage("请先登录后再收藏");
      return;
    }

    if (post.id.startsWith(INVALID_ID_PREFIX) || !canFetchArticleDetail(post.id)) {
      setActionMessage("当前文章暂不支持收藏");
      return;
    }

    const currentMeta = favoriteMetaMap[post.id] ?? createEmptyFavoriteMeta();
    if (currentMeta.busy) {
      return;
    }

    setActionMessage(null);
    if (!currentMeta.favorited) {
      setFavoriteDialogPost(post);
      return;
    }

    setFavoriteMetaMap((prev) => ({
      ...prev,
      [post.id]: {
        ...currentMeta,
        busy: true,
      },
    }));

    try {
      await deleteFavoriteItems(token, currentMeta.favoriteIds);
      setFavoriteMetaMap((prev) => ({
        ...prev,
        [post.id]: {
          ...createEmptyFavoriteMeta(),
        },
      }));
      setActionMessage("已取消收藏");
    } catch (error) {
      setFavoriteMetaMap((prev) => ({
        ...prev,
        [post.id]: {
          ...currentMeta,
          busy: false,
        },
      }));
      setActionMessage(error instanceof Error ? error.message : "收藏失败，请稍后重试");
    }
  };

  const refreshButtonLabel = isSearchMode
    ? normalizedQuery
      ? "重新搜索"
      : "刷新分区"
    : "刷新推荐";
  const refreshButtonActionLabel = isLoading ? "加载中..." : refreshButtonLabel;
  const refreshPanelTitle = isSearchMode
    ? normalizedQuery
      ? "搜索结果面板"
      : "分区内容面板"
    : "为你推荐";
  const refreshPanelDescription = isSearchMode
    ? normalizedQuery
      ? `当前关键词：${normalizedQuery}`
      : "按当前分区条件重新拉取一批内容"
    : "主动刷新一次，看看识海社区此刻想先推给你什么";
  const refreshPanelMeta = isLoading
    ? "正在同步最新内容"
    : posts.length > 0
      ? `当前展示 ${posts.length} 篇内容`
      : isSearchMode
        ? "准备重新拉取搜索结果"
        : "准备重新拉取推荐流";

  const handleManualRefresh = () => {
    setActionMessage(null);
    setRefreshFeedbackTick((prev) => prev + 1);
    setRefreshNonce((prev) => prev + 1);
  };

  const refreshFeedbackMessage = isLoading
    ? "\u6b63\u5728\u4e3a\u4f60\u62c9\u53d6\u6700\u65b0\u5185\u5bb9..."
    : showRefreshFeedback
      ? isSearchMode
        ? "\u5df2\u6536\u5230\uff0c\u6b63\u5728\u5237\u65b0\u5f53\u524d\u7ed3\u679c"
        : "\u5df2\u6536\u5230\uff0c\u6b63\u5728\u5237\u65b0\u63a8\u8350"
      : "\u70b9\u51fb\u540e\u4f1a\u7acb\u5373\u62c9\u53d6\u4e00\u6279\u65b0\u7684\u5185\u5bb9";

  const actionMessageIsError =
    !!actionMessage &&
    (actionMessage.includes("失败") ||
      actionMessage.includes("请先") ||
      actionMessage.includes("不支持") ||
      actionMessage.includes("同步"));

  const renderRefreshPanel = () => (
    <div className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,rgba(240,249,255,0.96),rgba(236,253,245,0.92))] p-4 shadow-sm shadow-sky-100/60">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-36 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_70%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm">
            {isSearchMode ? (
              <SearchIcon className="size-3.5" />
            ) : (
              <SparklesIcon className="size-3.5" />
            )}
            {refreshPanelTitle}
          </div>
          <div className="space-y-1">
            <p className="text-foreground text-base font-semibold tracking-tight">
              {isSearchMode ? "换一批更贴近当前检索的内容" : "刷新一轮新的推荐候选"}
            </p>
            <p className="text-muted-foreground text-sm">{refreshPanelDescription}</p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <div className="text-muted-foreground rounded-full bg-white/75 px-3 py-2 text-xs shadow-sm">
              {refreshPanelMeta}
            </div>
            <div className="relative">
              {showRefreshFeedback ? (
                <>
                  <span
                    key={`refresh-ring-${refreshFeedbackTick}`}
                    className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-sky-400/25"
                  />
                  <span
                    key={`refresh-glow-${refreshFeedbackTick}`}
                    className="pointer-events-none absolute -inset-1 animate-pulse rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.32),rgba(45,212,191,0.14),transparent_72%)] blur-md"
                  />
                </>
              ) : null}
              <Button
                variant="default"
                size="lg"
                onClick={handleManualRefresh}
                disabled={isLoading}
                className={`relative h-11 rounded-full px-5 text-sm font-semibold text-white transition-all duration-300 ${
                  showRefreshFeedback
                    ? "scale-[0.985] bg-slate-900 shadow-xl ring-4 shadow-sky-400/25 ring-sky-200/60 hover:bg-slate-800"
                    : "bg-slate-900 shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                }`}
              >
                <RefreshCcwIcon
                  className={
                    isLoading
                      ? "size-4 animate-spin"
                      : showRefreshFeedback
                        ? "size-4 animate-pulse"
                        : "size-4"
                  }
                />
                {refreshButtonActionLabel}
              </Button>
            </div>
          </div>
          <div
            aria-live="polite"
            className={`min-h-5 text-right text-xs transition-all duration-300 ${
              isLoading || showRefreshFeedback
                ? "translate-y-0 text-sky-700 opacity-100"
                : "-translate-y-1 text-slate-500 opacity-70"
            }`}
          >
            {refreshFeedbackMessage}
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    if (isSearchMode) {
      return (
        <div className="space-y-4">
          {renderRefreshPanel()}
          <p className="text-muted-foreground py-8 text-center">{"\u641c\u7d22\u4e2d..."}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {renderRefreshPanel()}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={`reco-skeleton-${index}`}
              className="border-border bg-card h-44 animate-pulse rounded-lg border p-4"
            >
              <div className="bg-muted h-4 w-2/3 rounded" />
              <div className="bg-muted mt-4 h-3 w-full rounded" />
              <div className="bg-muted mt-2 h-3 w-5/6 rounded" />
              <div className="bg-muted mt-6 h-3 w-1/3 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (fetchErrorMessage) {
    return (
      <div className="space-y-4">
        {renderRefreshPanel()}
        <p className="text-destructive py-8 text-center">{fetchErrorMessage}</p>
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="space-y-4">
        {renderRefreshPanel()}
        <p className="text-muted-foreground py-8 text-center">
          {isSearchMode
            ? normalizedQuery
              ? "\u672a\u641c\u7d22\u5230\u76f8\u5173\u5185\u5bb9"
              : "\u5f53\u524d\u5206\u533a\u6682\u65e0\u76f8\u5173\u6587\u7ae0"
            : "\u6682\u65e0\u6587\u7ae0\uff0c\u5feb\u53bb\u53d1\u5e03\u7b2c\u4e00\u7bc7\u5427\u3002"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderRefreshPanel()}
      {actionMessage && (
        <p className={`text-sm ${actionMessageIsError ? "text-destructive" : "text-primary"}`}>
          {actionMessage}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {posts.map((post) => {
          const meta = likeMetaMap[post.id];
          const favoriteMeta = favoriteMetaMap[post.id];
          return (
            <Card
              key={post.id}
              {...post}
              likeCount={meta?.likeCount ?? post.likes}
              dislikeCount={meta?.dislikeCount ?? 0}
              isLiked={meta?.likeState === LIKE_STATE.LIKED}
              isDisliked={meta?.likeState === LIKE_STATE.DISLIKED}
              isFavorited={favoriteMeta?.favorited ?? false}
              actionDisabled={meta?.busy}
              favoriteDisabled={favoriteMeta?.busy}
              onLike={handleLike}
              onDislike={handleDislike}
              onFavorite={handleFavorite}
            />
          );
        })}
      </div>

      <FavoritePickerDialog
        open={favoriteDialogPost !== null}
        token={token}
        target={
          favoriteDialogPost
            ? {
                targetId: favoriteDialogPost.id,
                title: favoriteDialogPost.title,
                cover: favoriteDialogPost.image,
              }
            : null
        }
        onOpenChange={(open) => {
          if (!open) {
            setFavoriteDialogPost(null);
          }
        }}
        onSaved={(favorite) => {
          if (!favoriteDialogPost) {
            return;
          }

          setFavoriteMetaMap((prev) => ({
            ...prev,
            [favoriteDialogPost.id]: {
              favorited: true,
              favoriteIds: Array.from(
                new Set([...(prev[favoriteDialogPost.id]?.favoriteIds ?? []), favorite.favoriteId]),
              ),
              busy: false,
            },
          }));
          setActionMessage("已加入收藏夹");
          setFavoriteDialogPost(null);
        }}
      />
    </div>
  );
};
