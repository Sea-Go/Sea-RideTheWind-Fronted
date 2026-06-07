"use client";

import {
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  RefreshCcwIcon,
  SearchIcon,
  SparklesIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserRoundIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_DASHBOARD_SEARCH_MODE } from "@/app/dashboard/_constants/search-mode";
import {
  buildDashboardTabSearchText,
  type DashboardTabSlug,
  DEFAULT_DASHBOARD_TAB,
} from "@/app/dashboard/_constants/tabs";
import { InteractiveSurface } from "@/components/motion/InteractiveSurface";
import { MotionList } from "@/components/motion/MotionList";
import { markNavigationStart } from "@/components/motion/navigation-timing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/services/auth";
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
import type {
  DashboardAuthorSearchResult,
  DashboardFeedResponse,
  DashboardPost,
  DashboardSearchEvidenceViewState,
  DashboardSearchMode,
  DashboardSearchTraceStageView,
} from "@/types";

import { Card } from "./Card";

const FavoritePickerDialog = dynamic(
  () =>
    import("@/components/favorite/FavoritePickerDialog").then((mod) => mod.FavoritePickerDialog),
  {
    loading: () => null,
    ssr: false,
  },
);

const INVALID_ID_PREFIX = "article-";
const DASHBOARD_FEED_MEMORY_TTL_MS = 60_000;
const PREFETCH_VISIBLE_CARD_LIMIT = 8;
const SEARCH_TOP_K = 20;
const SEARCH_SESSION_STORAGE_KEY = "dashboard_search_session_id";
const SEARCH_MODE_LABEL_MAP: Record<DashboardSearchMode, string> = {
  content: "内容搜索",
  title: "标题搜索",
  author: "作者名字搜索",
};
const SEARCH_MODE_RESULT_UNIT_MAP: Record<DashboardSearchMode, string> = {
  content: "篇内容",
  title: "个标题",
  author: "位作者",
};
const CARD_CONTROL_SELECTOR = "a,button,input,textarea,select,label,[data-card-open-ignore]";

const isCardControlTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && Boolean(target.closest(CARD_CONTROL_SELECTOR));

const formatCompactCount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(Math.max(0, Math.round(value)));
};

const formatPercentText = (value?: number | null, digits = 0): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return `${(value * 100).toFixed(digits)}%`;
};

const formatOptionalDate = (value?: string): string => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
};

const createCurrentTimeLabel = (): string =>
  new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const getSearchResultUnit = (mode: DashboardSearchMode): string =>
  SEARCH_MODE_RESULT_UNIT_MAP[mode];

const createEmptyFavoriteMeta = (): FavoriteMeta => ({
  favorited: false,
  favoriteIds: [],
  busy: false,
});

interface DashboardFeedMemoryCacheEntry {
  cachedAt: number;
  response: DashboardFeedResponse;
}

const dashboardFeedMemoryCache = new Map<string, DashboardFeedMemoryCacheEntry>();

const buildDashboardFeedCacheKey = ({
  mode,
  query,
  tabSlug,
  token,
}: {
  mode: DashboardSearchMode;
  query: string;
  tabSlug: DashboardTabSlug;
  token: string | null;
}): string => [token ?? "guest", tabSlug, mode, query].join("::");

const readDashboardFeedMemoryCache = (cacheKey: string): DashboardFeedResponse | null => {
  const cached = dashboardFeedMemoryCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > DASHBOARD_FEED_MEMORY_TTL_MS) {
    dashboardFeedMemoryCache.delete(cacheKey);
    return null;
  }

  return cached.response;
};

const saveDashboardFeedMemoryCache = (cacheKey: string, response: DashboardFeedResponse): void => {
  dashboardFeedMemoryCache.set(cacheKey, {
    cachedAt: Date.now(),
    response,
  });
};

const fetchDashboardFeed = async ({
  tabSlug,
  query,
  mode,
  force,
  token,
  sessionId,
}: {
  tabSlug: DashboardTabSlug;
  query: string;
  mode: DashboardSearchMode;
  force: boolean;
  token: string | null;
  sessionId: string;
}): Promise<DashboardFeedResponse> => {
  const headers = new Headers({
    "Content-Type": "application/json",
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch("/api/dashboard/feed", {
    method: "POST",
    headers,
    body: JSON.stringify({
      tabSlug,
      query,
      mode,
      force,
      sessionId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | (DashboardFeedResponse & { error?: string })
    | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error || "内容加载失败，请稍后重试");
  }

  return payload;
};

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
  mode?: DashboardSearchMode;
}

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const splitTagText = (value: unknown): string[] => {
  const text = toTrimmedString(value);
  if (!text) {
    return [];
  }

  return text
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const canFetchArticleDetail = (articleId: string): boolean => {
  if (!articleId) {
    return false;
  }

  return !articleId.startsWith("art_") && !articleId.startsWith("chk_");
};

const canOpenDashboardPost = (postId: string): boolean =>
  !postId.startsWith(INVALID_ID_PREFIX) && canFetchArticleDetail(postId);

const buildArticleDetailHref = (postId: string): string => `/article/${encodeURIComponent(postId)}`;

const buildAuthorDetailHref = (authorResult: DashboardAuthorSearchResult): string =>
  `/author/${encodeURIComponent(authorResult.authorId)}?name=${encodeURIComponent(authorResult.authorName)}`;

const collectPostSearchTags = (post: DashboardPost): string[] => {
  const tags = [
    ...splitTagText(post.searchEvidence?.typeTags),
    ...(post.searchEvidence?.tags?.filter(Boolean) ?? []),
  ];

  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 5);
};

const resolvePostMatchScore = (post: DashboardPost): number | null =>
  typeof post.searchEvidence?.matchScore === "number" &&
  Number.isFinite(post.searchEvidence.matchScore)
    ? post.searchEvidence.matchScore
    : null;

const buildClientSearchTraceSteps = (
  mode: DashboardSearchMode,
  query: string,
  resultCount: number,
): DashboardSearchTraceStageView[] => [
  {
    name: "query.submit",
    summary: "",
    details: [`查询词：${query}`, `模式：${SEARCH_MODE_LABEL_MAP[mode]}`],
  },
  {
    name:
      mode === "author" ? "search.author" : mode === "title" ? "search.title" : "search.content",
    summary: "",
    details: [`目标返回：${SEARCH_TOP_K} 条`],
  },
  {
    name: "view.compose",
    summary: "",
    details: [`当前展示：${resultCount} ${getSearchResultUnit(mode)}`],
  },
];

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

export const CardList = ({
  query = "",
  tabSlug = DEFAULT_DASHBOARD_TAB,
  mode = DEFAULT_DASHBOARD_SEARCH_MODE,
}: CardListProps) => {
  const router = useRouter();
  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const presetTabQuery = useMemo(() => {
    if (tabSlug === DEFAULT_DASHBOARD_TAB || normalizedQuery) {
      return "";
    }
    return buildDashboardTabSearchText(tabSlug).trim();
  }, [normalizedQuery, tabSlug]);
  const effectiveQuery = useMemo(
    () => (mode === "content" ? normalizedQuery || presetTabQuery : normalizedQuery).trim(),
    [mode, normalizedQuery, presetTabQuery],
  );
  const isSearchMode = effectiveQuery.length > 0;
  const isExplicitSearchMode = normalizedQuery.length > 0;
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [authorResults, setAuthorResults] = useState<DashboardAuthorSearchResult[]>([]);
  const [searchEvidenceView, setSearchEvidenceView] =
    useState<DashboardSearchEvidenceViewState | null>(null);
  const [selectedSearchResultId, setSelectedSearchResultId] = useState<string | null>(null);
  const [searchUpdatedAt, setSearchUpdatedAt] = useState("");
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
  const refreshFeedbackTimerRef = useRef<number | null>(null);
  const prefetchedPostIdsRef = useRef<Set<string>>(new Set());

  useEffect(
    () => () => {
      if (refreshFeedbackTimerRef.current !== null) {
        window.clearTimeout(refreshFeedbackTimerRef.current);
      }
    },
    [],
  );

  const selectedResultIds = useMemo(
    () =>
      mode === "author" ? authorResults.map((author) => author.id) : posts.map((post) => post.id),
    [authorResults, mode, posts],
  );
  const activeSelectedSearchResultId =
    isExplicitSearchMode &&
    selectedSearchResultId &&
    selectedResultIds.includes(selectedSearchResultId)
      ? selectedSearchResultId
      : (selectedResultIds[0] ?? null);
  const prefetchablePostIds = useMemo(
    () =>
      new Set(
        posts
          .slice(0, PREFETCH_VISIBLE_CARD_LIMIT)
          .map((post) => post.id)
          .filter(canOpenDashboardPost),
      ),
    [posts],
  );

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

  const applyDashboardFeedView = useCallback((feed: DashboardFeedResponse): void => {
    setPosts(feed.posts);
    setAuthorResults(feed.authorResults);
    setSearchEvidenceView(feed.searchEvidence);
    setAuthorIdMap(feed.authorIdMap);
    setSearchUpdatedAt(createCurrentTimeLabel());
    setFetchErrorMessage(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isManualRefresh = refreshNonce > handledRefreshNonceRef.current;
    handledRefreshNonceRef.current = refreshNonce;

    const fetchPosts = async (): Promise<void> => {
      const currentToken = getAuthToken();
      const cacheKey = buildDashboardFeedCacheKey({
        tabSlug,
        query: normalizedQuery,
        mode,
        token: currentToken,
      });
      const cachedFeed = isManualRefresh ? null : readDashboardFeedMemoryCache(cacheKey);
      let showedCachedFeed = false;

      setToken(currentToken);
      setActionMessage(null);
      setFetchErrorMessage(null);

      if (cachedFeed) {
        showedCachedFeed = true;
        setIsLoading(false);
        setLikeMetaMap({});
        setFavoriteMetaMap({});
        applyDashboardFeedView(cachedFeed);

        if (currentToken && cachedFeed.posts.length) {
          void loadLikeStates(currentToken, cachedFeed.posts);
          void loadFavoriteStates(currentToken, cachedFeed.posts);
        }
      } else {
        setIsLoading(true);
        setLikeMetaMap({});
        setFavoriteMetaMap({});
        setAuthorIdMap({});
        setSearchEvidenceView(null);
        setAuthorResults([]);
        setPosts([]);
        setSearchUpdatedAt("");
      }

      try {
        const feed = await fetchDashboardFeed({
          tabSlug,
          query: normalizedQuery,
          mode,
          force: isManualRefresh,
          token: currentToken,
          sessionId: getOrCreateSearchSessionId(),
        });

        if (cancelled) {
          return;
        }

        saveDashboardFeedMemoryCache(cacheKey, feed);
        applyDashboardFeedView(feed);
        setIsLoading(false);

        if (currentToken && feed.posts.length) {
          void loadLikeStates(currentToken, feed.posts);
          void loadFavoriteStates(currentToken, feed.posts);
        }
      } catch (error) {
        console.warn("Failed to load dashboard posts:", error);
        if (cancelled) {
          return;
        }

        if (showedCachedFeed) {
          setFetchErrorMessage(null);
          setActionMessage("已显示缓存内容，最新内容同步失败，可稍后手动刷新");
          setIsLoading(false);
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
        setAuthorResults([]);
        setIsLoading(false);
      }
    };

    void fetchPosts();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveQuery,
    applyDashboardFeedView,
    loadFavoriteStates,
    loadLikeStates,
    mode,
    normalizedQuery,
    refreshNonce,
    tabSlug,
  ]);

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

    try {
      const optimisticMeta = await steps.reduce<Promise<LikeMeta>>(
        async (metaPromise, step) => {
          const previousMeta = await metaPromise;
          const result = await likeAction(token, {
            target_type: "article",
            target_id: postId,
            action_type: step,
            author_id: authorIdMap[postId],
            weight: 1,
          });

          const nextMeta: LikeMeta = {
            likeCount: toNumber(result.like_count, previousMeta.likeCount),
            dislikeCount: toNumber(result.dislike_count, previousMeta.dislikeCount),
            likeState: applyReactionStep(previousMeta.likeState, step),
            busy: true,
          };

          setLikeMetaMap((prev) => ({
            ...prev,
            [postId]: nextMeta,
          }));

          return nextMeta;
        },
        Promise.resolve({ ...currentMeta, busy: true }),
      );

      setLikeMetaMap((prev) => ({
        ...prev,
        [postId]: {
          likeCount: optimisticMeta.likeCount,
          dislikeCount: optimisticMeta.dislikeCount,
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

  const openPostDetail = useCallback(
    (postId: string) => {
      if (!canOpenDashboardPost(postId)) {
        return;
      }

      const href = buildArticleDetailHref(postId);
      markNavigationStart(href);
      router.push(href);
    },
    [router],
  );

  const prefetchPostDetail = useCallback(
    (postId: string) => {
      if (
        !prefetchablePostIds.has(postId) ||
        !canOpenDashboardPost(postId) ||
        prefetchedPostIdsRef.current.has(postId)
      ) {
        return;
      }

      const href = buildArticleDetailHref(postId);
      prefetchedPostIdsRef.current.add(postId);
      router.prefetch(href);
    },
    [prefetchablePostIds, router],
  );

  const openAuthorDetail = useCallback(
    (authorResult: DashboardAuthorSearchResult) => {
      const href = buildAuthorDetailHref(authorResult);
      markNavigationStart(href);
      router.push(href);
    },
    [router],
  );

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
  const refreshPanelMeta = isLoading
    ? "正在同步最新内容"
    : posts.length > 0
      ? `当前展示 ${posts.length} 篇内容`
      : "暂无内容";

  const handleManualRefresh = () => {
    setActionMessage(null);
    setRefreshFeedbackTick((prev) => prev + 1);
    setShowRefreshFeedback(true);
    if (refreshFeedbackTimerRef.current !== null) {
      window.clearTimeout(refreshFeedbackTimerRef.current);
    }
    refreshFeedbackTimerRef.current = window.setTimeout(() => {
      setShowRefreshFeedback(false);
      refreshFeedbackTimerRef.current = null;
    }, 1100);
    setRefreshNonce((prev) => prev + 1);
  };

  const refreshFeedbackMessage = isLoading
    ? "\u6b63\u5728\u4e3a\u4f60\u62c9\u53d6\u6700\u65b0\u5185\u5bb9..."
    : showRefreshFeedback
      ? isSearchMode
        ? "\u5df2\u6536\u5230\uff0c\u6b63\u5728\u5237\u65b0\u5f53\u524d\u7ed3\u679c"
        : "\u5df2\u6536\u5230\uff0c\u6b63\u5728\u5237\u65b0\u63a8\u8350"
      : "";

  const actionMessageIsError =
    !!actionMessage &&
    (actionMessage.includes("失败") ||
      actionMessage.includes("请先") ||
      actionMessage.includes("不支持") ||
      actionMessage.includes("同步"));

  const selectedPost = useMemo(
    () =>
      mode === "author"
        ? null
        : (posts.find((post) => post.id === activeSelectedSearchResultId) ?? posts[0] ?? null),
    [activeSelectedSearchResultId, mode, posts],
  );
  const selectedAuthorResult = useMemo(
    () =>
      mode === "author"
        ? (authorResults.find((author) => author.id === activeSelectedSearchResultId) ??
          authorResults[0] ??
          null)
        : null,
    [activeSelectedSearchResultId, authorResults, mode],
  );
  const heroImage = useMemo(
    () => posts.find((post) => post.image)?.image ?? selectedPost?.image ?? null,
    [posts, selectedPost],
  );
  const averageMatchScore = useMemo(() => {
    const scores = posts
      .map(resolvePostMatchScore)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    if (!scores.length) {
      return null;
    }
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }, [posts]);
  const explicitResultCount = mode === "author" ? authorResults.length : posts.length;
  const searchTraceSteps = useMemo(() => {
    if (mode === "content" && searchEvidenceView?.steps.length) {
      return searchEvidenceView.steps;
    }
    return buildClientSearchTraceSteps(mode, normalizedQuery, explicitResultCount);
  }, [explicitResultCount, mode, normalizedQuery, searchEvidenceView]);

  const renderSearchEvidencePanel = () => {
    if (!isSearchMode || mode !== "content" || !searchEvidenceView) {
      return null;
    }

    return (
      <section className="border-border bg-card/85 overflow-hidden rounded-2xl border p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold">
              检索证据链
            </span>
            {searchEvidenceView.traceId ? (
              <span className="border-border bg-background/70 text-muted-foreground rounded-full border px-3 py-1 font-mono text-[11px]">
                trace {searchEvidenceView.traceId}
              </span>
            ) : null}
            {searchEvidenceView.searchRequestId ? (
              <span className="border-border bg-background/70 text-muted-foreground rounded-full border px-3 py-1 font-mono text-[11px]">
                request {searchEvidenceView.searchRequestId}
              </span>
            ) : null}
            <span className="border-primary/25 bg-primary/10 text-primary rounded-full border px-3 py-1 text-[11px] font-medium">
              状态 {searchEvidenceView.status || "ok"}
            </span>
          </div>
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="border-border bg-background/60 space-y-3 rounded-2xl border p-4">
              <div>
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                  Query
                </p>
                <p className="text-foreground mt-1 text-sm font-semibold">
                  {searchEvidenceView.searchText || effectiveQuery}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border-primary/25 bg-primary/10 text-primary rounded-full border px-2 py-1">
                  意图 {searchEvidenceView.intentLabel}
                </span>
                {searchEvidenceView.intentConfidence !== null ? (
                  <span className="border-border bg-card/80 text-muted-foreground rounded-full border px-2 py-1">
                    置信度 {(searchEvidenceView.intentConfidence * 100).toFixed(0)}%
                  </span>
                ) : null}
              </div>
              {searchEvidenceView.keywords.length ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                    Keywords
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchEvidenceView.keywords.map((keyword) => (
                      <span
                        key={`search-keyword-${keyword}`}
                        className="border-border bg-muted/70 text-foreground rounded-full border px-2 py-1 text-xs"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {searchEvidenceView.steps.map((step, index) => (
                <div
                  key={`${step.name}-${index}`}
                  className="border-border bg-background/65 rounded-2xl border p-4 shadow-sm"
                >
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                    Step {index + 1}
                  </p>
                  <p className="text-foreground mt-1 text-sm font-semibold">{step.name}</p>
                  {step.summary ? (
                    <p className="text-muted-foreground mt-2 text-sm leading-6">{step.summary}</p>
                  ) : null}
                  {step.details.length ? (
                    <div className="text-muted-foreground mt-3 space-y-1 text-xs leading-5">
                      {step.details.map((detail) => (
                        <p key={`${step.name}-${detail}`}>{detail}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderRefreshPanel = () => (
    <div className="border-border bg-card/80 relative overflow-hidden rounded-2xl border p-4 shadow-sm backdrop-blur">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-36 opacity-70"
        style={{ background: "radial-gradient(circle at center, var(--primary), transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="border-border bg-background/65 text-primary inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm">
            {isSearchMode ? (
              <SearchIcon className="size-3.5" />
            ) : (
              <SparklesIcon className="size-3.5" />
            )}
            {refreshPanelTitle}
          </div>
          <div className="space-y-1">
            <p className="text-foreground text-base font-semibold tracking-tight">
              {refreshButtonLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <div className="text-muted-foreground bg-background/65 rounded-full px-3 py-2 text-xs shadow-sm">
              {refreshPanelMeta}
            </div>
            <div className="relative">
              {showRefreshFeedback ? (
                <>
                  <span
                    key={`refresh-ring-${refreshFeedbackTick}`}
                    className="bg-primary/25 pointer-events-none absolute inset-0 animate-ping rounded-full"
                  />
                  <span
                    key={`refresh-glow-${refreshFeedbackTick}`}
                    className="bg-primary/20 pointer-events-none absolute -inset-1 animate-pulse rounded-full blur-md"
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
                    ? "ring-primary/25 scale-[0.985] shadow-xl ring-4"
                    : "shadow-primary/15 shadow-lg"
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
                ? "text-primary translate-y-0 opacity-100"
                : "text-muted-foreground -translate-y-1 opacity-70"
            }`}
          >
            {refreshFeedbackMessage}
          </div>
        </div>
      </div>
    </div>
  );

  const renderFavoriteDialog = () => (
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
  );

  const renderExplicitSearchHero = () => {
    const averageMatchText = formatPercentText(averageMatchScore);
    const hitMetric = averageMatchText
      ? { label: "平均匹配", value: averageMatchText }
      : { label: "命中结果", value: `${explicitResultCount} ${getSearchResultUnit(mode)}` };
    const secondaryMetric =
      mode === "author"
        ? {
            label: "关联文章",
            value: `${formatCompactCount(
              authorResults.reduce((sum, item) => sum + item.articleCount, 0),
            )} 篇`,
          }
        : {
            label: "有效封面",
            value: `${posts.filter((post) => post.image).length} 张`,
          };

    return (
      <section className="border-border bg-card/80 relative overflow-hidden rounded-[1rem] border shadow-lg shadow-black/10">
        {heroImage ? (
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1120px"
            className="object-cover opacity-45"
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "var(--app-search-hero-overlay)" }}
        />
        <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0 space-y-3">
            <div className="border-border bg-card/80 text-primary inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm">
              <SparklesIcon className="size-3.5" />
              {SEARCH_MODE_LABEL_MAP[mode]}
            </div>
            <div className="space-y-2">
              <h2 className="text-foreground text-2xl font-bold sm:text-3xl">
                为你找到关于「{normalizedQuery}」的灵感
              </h2>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-2 text-xs font-semibold">
              <span className="border-border bg-card/75 rounded-full border px-3 py-1.5">
                相关内容{" "}
                <strong className="text-primary">
                  {explicitResultCount} {getSearchResultUnit(mode)}
                </strong>
              </span>
              <span className="border-border bg-card/75 rounded-full border px-3 py-1.5">
                {hitMetric.label} <strong className="text-primary">{hitMetric.value}</strong>
              </span>
              <span className="border-border bg-card/75 rounded-full border px-3 py-1.5">
                {secondaryMetric.label}{" "}
                <strong className="text-primary">{secondaryMetric.value}</strong>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="border-border bg-card/80 text-muted-foreground rounded-full border px-4 py-2 text-xs font-medium shadow-sm">
              {searchUpdatedAt ? `更新于 ${searchUpdatedAt}` : "正在同步结果"}
            </div>
            <Button
              type="button"
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="shadow-primary/20 h-11 rounded-full px-5 shadow-lg"
            >
              <RefreshCcwIcon className={cn("size-4", isLoading ? "animate-spin" : "")} />
              {isLoading ? "搜索中" : "刷新结果"}
            </Button>
          </div>
        </div>
      </section>
    );
  };

  const renderExplicitSearchTracePanel = () => {
    const hasBackendTrace = mode === "content" && searchEvidenceView;

    return (
      <section className="border-border bg-card/78 rounded-[1rem] border p-4 shadow-md shadow-black/5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-foreground flex items-center gap-2 text-sm font-bold">
            <SearchIcon className="text-primary size-4" />
            搜索过程追踪
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]">
            {hasBackendTrace && searchEvidenceView.traceId ? (
              <span className="border-border bg-muted/70 text-primary rounded-full border px-2.5 py-1 font-mono">
                trace_{searchEvidenceView.traceId}
              </span>
            ) : null}
            {hasBackendTrace && searchEvidenceView.searchRequestId ? (
              <span className="border-border bg-card/80 rounded-full border px-2.5 py-1 font-mono">
                {searchEvidenceView.searchRequestId}
              </span>
            ) : null}
            {hasBackendTrace ? (
              <span className="border-primary/25 bg-primary/10 text-primary rounded-full border px-2.5 py-1 font-semibold">
                状态 {searchEvidenceView.status || "ok"}
              </span>
            ) : (
              <span className="border-border bg-card/80 rounded-full border px-2.5 py-1">
                客户端视图链路
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-stretch gap-3">
            <div className="border-border bg-background/65 w-36 shrink-0 rounded-[0.75rem] border p-3 shadow-sm">
              <p className="text-muted-foreground text-[11px] font-semibold">查询词</p>
              <p className="text-primary mt-2 line-clamp-2 text-sm font-bold">{normalizedQuery}</p>
              {searchEvidenceView?.keywords.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {searchEvidenceView.keywords.slice(0, 3).map((keyword) => (
                    <span
                      key={`explicit-keyword-${keyword}`}
                      className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {searchTraceSteps.map((step, index) => (
              <div key={`${step.name}-${index}`} className="flex items-center gap-3">
                <ArrowRightIcon className="text-primary size-4 shrink-0" />
                <div className="border-border bg-background/65 w-40 shrink-0 rounded-[0.75rem] border p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/10 text-primary inline-flex size-6 items-center justify-center rounded-full">
                      {index === searchTraceSteps.length - 1 ? (
                        <CheckCircle2Icon className="size-3.5" />
                      ) : (
                        <FileTextIcon className="size-3.5" />
                      )}
                    </span>
                    <span className="text-muted-foreground text-[11px] font-semibold">
                      STEP {index + 1}
                    </span>
                  </div>
                  <p className="text-foreground mt-2 line-clamp-1 text-sm font-bold">{step.name}</p>
                  <p className="text-muted-foreground mt-1 line-clamp-2 min-h-8 text-xs leading-4">
                    {step.summary}
                  </p>
                  {step.details[0] ? (
                    <p className="text-primary mt-2 line-clamp-1 text-[11px] font-medium">
                      {step.details[0]}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderPostSearchCard = (post: DashboardPost, index: number) => {
    const meta = likeMetaMap[post.id];
    const favoriteMeta = favoriteMetaMap[post.id];
    const matchText = formatPercentText(resolvePostMatchScore(post));
    const tags = collectPostSearchTags(post);
    const publishedAt = formatOptionalDate(post.publishedAt);
    const isSelected =
      activeSelectedSearchResultId === post.id || (!activeSelectedSearchResultId && index === 0);

    return (
      <InteractiveSurface
        variant="card"
        key={post.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedSearchResultId(post.id)}
        onFocus={() => prefetchPostDetail(post.id)}
        onPointerEnter={() => prefetchPostDetail(post.id)}
        onDoubleClick={(event: MouseEvent<HTMLElement>) => {
          if (isCardControlTarget(event.target)) {
            return;
          }
          openPostDetail(post.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedSearchResultId(post.id);
          }
        }}
        className={cn(
          "bg-card/90 group flex min-h-[18rem] cursor-pointer flex-col overflow-hidden rounded-[0.75rem] border shadow-md shadow-black/5",
          isSelected ? "border-primary ring-primary/25 ring-2" : "border-border/80",
        )}
      >
        <div className="bg-muted relative h-32 overflow-hidden">
          {post.image ? (
            <Image
              src={post.image}
              alt={post.title}
              fill
              priority={index === 0}
              sizes="(max-width: 768px) 100vw, 320px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="from-muted via-card to-accent text-primary flex h-full items-center justify-center bg-gradient-to-br">
              <FileTextIcon className="size-8" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="space-y-2">
            <h3 className="text-foreground line-clamp-2 text-base leading-6 font-bold">
              {post.title}
            </h3>
            <p className="text-muted-foreground line-clamp-2 min-h-10 text-sm leading-5">
              {post.content}
            </p>
          </div>

          {tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={`${post.id}-search-tag-${tag}`}
                  className="bg-accent text-accent-foreground rounded-full px-2 py-1 text-[11px] font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-2 text-[11px] font-medium">
            {matchText ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2Icon className="size-3" />
                {matchText} 匹配
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <ThumbsUpIcon className="size-3" />
              {formatCompactCount(meta?.likeCount ?? post.likes)}
            </span>
            {publishedAt ? (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-3" />
                {publishedAt}
              </span>
            ) : null}
          </div>
        </div>

        <div className="border-border bg-muted/45 flex items-center justify-between border-t px-3 py-2">
          <span className="text-muted-foreground line-clamp-1 text-[11px] font-medium">
            {post.author}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={meta?.likeState === LIKE_STATE.LIKED ? "default" : "ghost"}
              size="sm"
              disabled={meta?.busy}
              onClick={(event) => {
                event.stopPropagation();
                void handleLike(post.id);
              }}
              className="h-7 rounded-full px-2"
              aria-label="点赞"
            >
              <ThumbsUpIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant={meta?.likeState === LIKE_STATE.DISLIKED ? "destructive" : "ghost"}
              size="sm"
              disabled={meta?.busy}
              onClick={(event) => {
                event.stopPropagation();
                void handleDislike(post.id);
              }}
              className="h-7 rounded-full px-2"
              aria-label="点踩"
            >
              <ThumbsDownIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant={favoriteMeta?.favorited ? "default" : "outline"}
              size="sm"
              disabled={favoriteMeta?.busy}
              onClick={(event) => {
                event.stopPropagation();
                void handleFavorite({ id: post.id, title: post.title, image: post.image });
              }}
              className="border-border h-7 rounded-full px-2"
              aria-label={favoriteMeta?.favorited ? "取消收藏" : "收藏"}
            >
              <BookmarkIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </InteractiveSurface>
    );
  };

  const renderAuthorSearchCard = (authorResult: DashboardAuthorSearchResult, index: number) => {
    const isSelected =
      activeSelectedSearchResultId === authorResult.id ||
      (!activeSelectedSearchResultId && index === 0);

    return (
      <InteractiveSurface
        variant="card"
        key={authorResult.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedSearchResultId(authorResult.id)}
        onDoubleClick={(event: MouseEvent<HTMLElement>) => {
          if (isCardControlTarget(event.target)) {
            return;
          }
          openAuthorDetail(authorResult);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedSearchResultId(authorResult.id);
          }
        }}
        className={cn(
          "bg-card/90 cursor-pointer rounded-[0.75rem] border p-4 shadow-md shadow-black/5",
          isSelected ? "border-primary ring-primary/25 ring-2" : "border-border/80",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="bg-accent text-primary inline-flex size-12 shrink-0 items-center justify-center rounded-full">
            <UserRoundIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground line-clamp-1 text-base font-bold">
              {authorResult.authorName}
            </p>
            <p className="text-muted-foreground mt-1 font-mono text-[11px]">
              {authorResult.authorId}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-accent rounded-[0.65rem] px-3 py-2">
            <p className="text-muted-foreground text-[11px]">文章数</p>
            <p className="text-primary mt-1 text-lg font-bold">{authorResult.articleCount}</p>
          </div>
          <div className="bg-muted rounded-[0.65rem] px-3 py-2">
            <p className="text-muted-foreground text-[11px]">最近文章</p>
            <p className="text-foreground mt-1 line-clamp-1 text-sm font-semibold">
              {authorResult.latestArticleTitle || "暂无标题"}
            </p>
          </div>
        </div>
      </InteractiveSurface>
    );
  };

  const renderSelectedPostDetail = () => {
    if (!selectedPost) {
      return null;
    }

    const tags = collectPostSearchTags(selectedPost);
    const matchText = formatPercentText(resolvePostMatchScore(selectedPost));
    const publishedAt = formatOptionalDate(selectedPost.publishedAt);
    const detailHref = canOpenDashboardPost(selectedPost.id)
      ? `/article/${encodeURIComponent(selectedPost.id)}`
      : "";

    return (
      <aside className="border-border bg-card/92 overflow-hidden rounded-[0.85rem] border shadow-lg shadow-black/10 xl:sticky xl:top-6">
        <div className="bg-muted relative h-44">
          {selectedPost.image ? (
            <Image
              src={selectedPost.image}
              alt={selectedPost.title}
              fill
              sizes="(max-width: 1280px) 100vw, 400px"
              className="object-cover"
            />
          ) : (
            <div className="from-muted via-card to-accent text-primary flex h-full items-center justify-center bg-gradient-to-br">
              <FileTextIcon className="size-10" />
            </div>
          )}
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-1">
                精选结果
              </span>
              {matchText ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  匹配度 {matchText}
                </span>
              ) : null}
            </div>
            <h3 className="text-foreground text-xl leading-7 font-bold">{selectedPost.title}</h3>
            <p className="text-muted-foreground text-sm leading-6">{selectedPost.content}</p>
          </div>

          {selectedPost.searchEvidence?.snippet ? (
            <div className="border-border bg-muted/70 rounded-[0.75rem] border p-3">
              <p className="text-foreground mb-1 text-xs font-bold">命中片段</p>
              <p className="text-muted-foreground line-clamp-5 text-xs leading-5">
                {selectedPost.searchEvidence.snippet}
              </p>
            </div>
          ) : null}

          {tags.length ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={`detail-tag-${selectedPost.id}-${tag}`}
                  className="bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-xs font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="bg-muted text-muted-foreground grid gap-2 rounded-[0.75rem] p-3 text-xs">
            <span className="inline-flex items-center gap-2">
              <UserRoundIcon className="text-primary size-3.5" />
              {selectedPost.author}
            </span>
            {publishedAt ? (
              <span className="inline-flex items-center gap-2">
                <ClockIcon className="text-primary size-3.5" />
                发布时间：{publishedAt}
              </span>
            ) : null}
          </div>

          {detailHref ? (
            <Button asChild className="w-full rounded-full">
              <Link href={detailHref}>
                查看原文
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button className="w-full rounded-full" disabled>
              暂无原文入口
            </Button>
          )}
        </div>
      </aside>
    );
  };

  const renderSelectedAuthorDetail = () => {
    if (!selectedAuthorResult) {
      return null;
    }

    return (
      <aside className="border-border bg-card/92 rounded-[0.85rem] border p-5 shadow-lg shadow-black/10 xl:sticky xl:top-6">
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <span className="bg-accent text-primary inline-flex size-14 shrink-0 items-center justify-center rounded-full">
              <UserRoundIcon className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-primary text-xs font-semibold">精选作者</p>
              <h3 className="text-foreground mt-1 text-xl font-bold">
                {selectedAuthorResult.authorName}
              </h3>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {selectedAuthorResult.authorId}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-accent rounded-[0.75rem] p-3">
              <p className="text-muted-foreground text-xs">文章数</p>
              <p className="text-primary mt-2 text-2xl font-bold">
                {selectedAuthorResult.articleCount}
              </p>
            </div>
            <div className="bg-muted rounded-[0.75rem] p-3">
              <p className="text-muted-foreground text-xs">最近动态</p>
              <p className="text-foreground mt-2 line-clamp-2 text-sm font-semibold">
                {selectedAuthorResult.latestArticleTitle || "暂无最近文章"}
              </p>
            </div>
          </div>

          {selectedAuthorResult.latestArticleTime ? (
            <div className="border-border bg-card text-muted-foreground rounded-[0.75rem] border p-3 text-xs">
              <ClockIcon className="text-primary mr-1 inline size-3.5" />
              最近发布时间：{selectedAuthorResult.latestArticleTime}
            </div>
          ) : null}

          <Button asChild className="w-full rounded-full">
            <Link
              href={`/author/${encodeURIComponent(selectedAuthorResult.authorId)}?name=${encodeURIComponent(selectedAuthorResult.authorName)}`}
            >
              进入作者主页
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </aside>
    );
  };

  const renderExplicitSearchResults = () => {
    if (isLoading) {
      return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`explicit-search-skeleton-${index}`}
                className="border-border bg-card/80 h-72 animate-pulse rounded-[0.75rem] border p-4 shadow-sm"
              >
                <div className="bg-muted h-28 rounded-[0.65rem]" />
                <div className="bg-muted mt-4 h-4 w-2/3 rounded" />
                <div className="bg-muted mt-3 h-3 w-full rounded" />
                <div className="bg-muted mt-2 h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
          <div className="border-border bg-card/80 hidden h-96 animate-pulse rounded-[0.85rem] border xl:block" />
        </div>
      );
    }

    if (fetchErrorMessage) {
      return (
        <section className="rounded-[1rem] border border-red-100 bg-red-50/80 p-8 text-center text-sm font-medium text-red-600">
          {fetchErrorMessage}
        </section>
      );
    }

    if (!hasRenderableResults) {
      return (
        <section className="border-border bg-card/82 rounded-[1rem] border p-8 text-center">
          <SearchIcon className="text-primary mx-auto size-8" />
          <p className="text-foreground mt-3 text-sm font-semibold">
            {mode === "author"
              ? "未搜索到相关作者"
              : mode === "title"
                ? "未搜索到相关标题"
                : "未搜索到相关内容"}
          </p>
        </section>
      );
    }

    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
        {hasAuthorResults ? (
          <MotionList className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {authorResults.map(renderAuthorSearchCard)}
          </MotionList>
        ) : (
          <MotionList className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {posts.map(renderPostSearchCard)}
          </MotionList>
        )}
        {hasAuthorResults ? renderSelectedAuthorDetail() : renderSelectedPostDetail()}
      </div>
    );
  };

  const renderExplicitSearchExperience = () => (
    <div className="space-y-4">
      {renderExplicitSearchHero()}
      {renderExplicitSearchTracePanel()}
      {actionMessage && (
        <p className={`text-sm ${actionMessageIsError ? "text-destructive" : "text-primary"}`}>
          {actionMessage}
        </p>
      )}
      {renderExplicitSearchResults()}
      {renderFavoriteDialog()}
    </div>
  );

  const renderAuthorResultGrid = () => (
    <MotionList className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {authorResults.map((authorResult) => (
        <InteractiveSurface asChild variant="card" key={authorResult.id}>
          <Link
            href={`/author/${encodeURIComponent(authorResult.authorId)}?name=${encodeURIComponent(authorResult.authorName)}`}
            className="border-border bg-card group rounded-3xl border p-5 shadow-sm"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="border-border bg-muted rounded-full border px-2 py-1">
                    作者检索
                  </span>
                  <span className="font-mono">{authorResult.authorId}</span>
                </div>
                <h3 className="text-foreground group-hover:text-primary text-lg font-semibold tracking-tight transition-colors">
                  {authorResult.authorName}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border-border bg-muted/80 rounded-2xl border p-3">
                  <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
                    文章数
                  </p>
                  <p className="text-foreground mt-2 text-xl font-semibold">
                    {authorResult.articleCount}
                  </p>
                </div>
                <div className="border-border bg-accent/70 rounded-2xl border p-3">
                  <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
                    最近文章
                  </p>
                  <p className="text-foreground mt-2 line-clamp-2 text-sm font-medium">
                    {authorResult.latestArticleTitle || "暂无最近文章标题"}
                  </p>
                </div>
              </div>

              {authorResult.latestArticleTime ? (
                <p className="text-muted-foreground text-sm">
                  最近发布时间：{authorResult.latestArticleTime}
                </p>
              ) : null}

              <div className="bg-primary text-primary-foreground group-hover:bg-primary/90 inline-flex items-center rounded-full px-3 py-2 text-sm font-medium transition-colors">
                进入作者主页
              </div>
            </div>
          </Link>
        </InteractiveSurface>
      ))}
    </MotionList>
  );

  const hasAuthorResults = mode === "author" && authorResults.length > 0;
  const hasRenderableResults = hasAuthorResults || posts.length > 0;

  if (isExplicitSearchMode) {
    return renderExplicitSearchExperience();
  }

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        {renderSearchEvidencePanel()}
        <p className="text-destructive py-8 text-center">{fetchErrorMessage}</p>
      </div>
    );
  }

  if (!hasRenderableResults) {
    return (
      <div className="space-y-4">
        {renderRefreshPanel()}
        {renderSearchEvidencePanel()}
        <p className="text-muted-foreground py-8 text-center">
          {isSearchMode
            ? normalizedQuery
              ? mode === "author"
                ? "未搜索到相关作者"
                : mode === "title"
                  ? "未搜索到相关标题"
                  : "\u672a\u641c\u7d22\u5230\u76f8\u5173\u5185\u5bb9"
              : "\u5f53\u524d\u5206\u533a\u6682\u65e0\u76f8\u5173\u6587\u7ae0"
            : "\u6682\u65e0\u6587\u7ae0\uff0c\u5feb\u53bb\u53d1\u5e03\u7b2c\u4e00\u7bc7\u5427\u3002"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderRefreshPanel()}
      {renderSearchEvidencePanel()}
      {actionMessage && (
        <p className={`text-sm ${actionMessageIsError ? "text-destructive" : "text-primary"}`}>
          {actionMessage}
        </p>
      )}
      {hasAuthorResults ? (
        renderAuthorResultGrid()
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((post, index) => {
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
                imagePriority={index === 0}
                onLike={handleLike}
                onDislike={handleDislike}
                onFavorite={handleFavorite}
                onOpen={openPostDetail}
                onPrefetch={prefetchPostDetail}
              />
            );
          })}
        </div>
      )}

      {renderFavoriteDialog()}
    </div>
  );
};
