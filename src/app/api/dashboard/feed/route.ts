import { NextRequest, NextResponse } from "next/server";

import {
  buildDashboardTabSearchText,
  DASHBOARD_TAB_SLUG_SET,
  type DashboardTabSlug,
  DEFAULT_DASHBOARD_TAB,
} from "@/app/dashboard/_constants/tabs";
import { ARTICLE_API_PATHS, RECO_API_PATHS, USER_CENTER_API_PATHS } from "@/constants/api-paths";
import type {
  DashboardAuthorSearchResult,
  DashboardFeedRequest,
  DashboardFeedResponse,
  DashboardPost,
  DashboardSearchEvidenceViewState,
  DashboardSearchMode,
  DashboardSearchTraceStageView,
} from "@/types";

const FALLBACK_TITLE = "未命名文章";
const FALLBACK_AUTHOR = "未知作者";
const FALLBACK_CONTENT = "暂无摘要";
const INVALID_ID_PREFIX = "article-";
const SEARCH_TOP_K = 20;
const RECOMMEND_SURFACE = "dashboard_recommend";
const RECO_FRESH_TTL_MS = 5 * 60 * 1000;
const SEARCH_MODE_LABEL_MAP: Record<DashboardSearchMode, string> = {
  content: "内容搜索",
  title: "标题搜索",
  author: "作者名字搜索",
};

interface CachedFeed {
  response: DashboardFeedResponse;
  fetchedAt: number;
}

const feedCache = new Map<string, CachedFeed>();
const inflightFeeds = new Map<string, Promise<DashboardFeedResponse>>();

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toTrimmedString = (value: unknown): string =>
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

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (item === undefined || item === null ? "" : String(item).trim()))
        .filter(Boolean)
    : [];

const splitTagText = (value: unknown): string[] => {
  const text = toTrimmedString(value);
  return text
    ? text
        .split(/[，,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
};

const pickFirstArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const arrayKeys = ["list", "articles", "items", "records", "rows", "hits", "authors"] as const;
  for (const key of arrayKeys) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }

  return record.data ? pickFirstArray(record.data) : [];
};

const normalizeSearchMode = (value: unknown): DashboardSearchMode =>
  value === "title" || value === "author" ? value : "content";

const normalizeTabSlug = (value: unknown): DashboardTabSlug => {
  const text = toTrimmedString(value);
  return DASHBOARD_TAB_SLUG_SET.has(text) ? (text as DashboardTabSlug) : DEFAULT_DASHBOARD_TAB;
};

const createRequestId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeSessionId = (value: unknown): string => {
  const text = toTrimmedString(value);
  return text || `dashboard-feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const buildHeaders = (authorization: string | null, contentType = true): Headers => {
  const headers = new Headers();
  if (contentType) {
    headers.set("Content-Type", "application/json");
  }
  if (authorization) {
    headers.set("Authorization", authorization);
  }
  return headers;
};

const parsePayload = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const unwrapPayload = <T>(payload: unknown): T => {
  const record = asRecord(payload);
  if (record && typeof record.code === "number" && Object.hasOwn(record, "data")) {
    if (record.code !== 200) {
      throw new Error(toTrimmedString(record.msg) || "请求失败");
    }
    return record.data as T;
  }
  return payload as T;
};

const internalRequest = async <T>(
  origin: string,
  path: string,
  init: RequestInit,
  { raw = false }: { raw?: boolean } = {},
): Promise<T> => {
  const response = await fetch(new URL(path, origin), {
    ...init,
    cache: "no-store",
  });
  const payload = await parsePayload(response);
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(toTrimmedString(record?.msg ?? record?.message ?? record?.error) || "请求失败");
  }
  return raw ? (payload as T) : unwrapPayload<T>(payload);
};

const getInternalOrigin = (request: NextRequest): string => {
  const configured = process.env.NEXT_SERVER_INTERNAL_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return `http://127.0.0.1:${process.env.PORT?.trim() || "3000"}`;
  }

  return request.nextUrl.origin;
};

const getCurrentUserId = async (
  origin: string,
  authorization: string | null,
): Promise<string | null> => {
  if (!authorization) {
    return null;
  }

  try {
    const profile = await internalRequest<{ user?: { uid?: unknown } }>(
      origin,
      USER_CENTER_API_PATHS.getUser,
      {
        method: "GET",
        headers: buildHeaders(authorization, false),
      },
    );
    return toTrimmedString(profile.user?.uid) || null;
  } catch (error) {
    console.warn("Dashboard feed fallback to guest user:", error);
    return null;
  }
};

const collectIdCandidates = (record: Record<string, unknown>): unknown[] => {
  const values: unknown[] = [record.article_id, record.id, record.target_id, record.articleId];
  const nestedKeys = ["doc", "article", "source", "payload", "item", "data", "hit"] as const;
  for (const key of nestedKeys) {
    const nestedRecord = asRecord(record[key]);
    if (nestedRecord) {
      values.push(
        nestedRecord.article_id,
        nestedRecord.id,
        nestedRecord.target_id,
        nestedRecord.articleId,
      );
    }
  }
  return values;
};

const pickArticleId = (record: Record<string, unknown>): string =>
  collectIdCandidates(record)
    .map((value) => toTrimmedString(value))
    .find(Boolean) ?? "";

const extractSearchDataRecord = (payload: unknown): Record<string, unknown> | null => {
  const payloadRecord = asRecord(payload);
  return payloadRecord ? (asRecord(payloadRecord.data) ?? payloadRecord) : null;
};

const extractSearchItems = (payload: unknown): Record<string, unknown>[] => {
  const dataRecord = extractSearchDataRecord(payload);
  if (!dataRecord) {
    return [];
  }

  const rawItems = pickFirstArray(dataRecord.items ?? dataRecord.hits ?? dataRecord.list);
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }
    const articleId = pickArticleId(record);
    const chunkId = toTrimmedString(record.chunk_id ?? record.chunkId);
    const key = articleId ? `article:${articleId}` : chunkId ? `chunk:${chunkId}` : "";
    if (key && seen.has(key)) {
      continue;
    }
    if (key) {
      seen.add(key);
    }
    items.push(record);
  }

  return items;
};

const extractAuthorSearchItems = (payload: unknown): Record<string, unknown>[] => {
  const dataRecord = extractSearchDataRecord(payload);
  return dataRecord
    ? pickFirstArray(dataRecord.authors ?? dataRecord.items ?? dataRecord.list)
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
};

const extractRecommendIds = (payload: unknown): string[] => {
  const record = extractSearchDataRecord(payload);
  if (!record) {
    return [];
  }

  const directIds = toStringArray(record.ids);
  if (directIds.length) {
    return directIds;
  }

  const compatIds = toStringArray(record.article_ids);
  if (compatIds.length) {
    return compatIds;
  }

  const rawItems = pickFirstArray(
    record.list ?? record.articles ?? record.items ?? record.records ?? record.hits,
  );
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of rawItems) {
    const itemRecord = asRecord(item);
    if (!itemRecord) {
      continue;
    }
    const id = pickArticleId(itemRecord);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
};

const pickArticleFromPayload = (payload: unknown): Record<string, unknown> | null => {
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
      return nestedArticle;
    }
    if (
      ["id", "article_id", "title", "brief", "content", "author_id"].some((key) =>
        Object.hasOwn(candidateRecord, key),
      )
    ) {
      return candidateRecord;
    }
  }
  return null;
};

const canFetchArticleDetail = (articleId: string): boolean =>
  Boolean(articleId) && !articleId.startsWith("art_") && !articleId.startsWith("chk_");

const resolveAuthorText = (article: Record<string, unknown>): string => {
  const authorName = toTrimmedString(article.author_name);
  const username = toTrimmedString(article.username);
  const authorId = toTrimmedString(article.author_id);
  return authorName || username || (authorId ? `用户 ${authorId}` : FALLBACK_AUTHOR);
};

const toDashboardPost = (
  article: Record<string, unknown>,
  index: number,
  fallbackId?: string,
): DashboardPost => {
  const id =
    toTrimmedString(article.id ?? article.article_id) ||
    fallbackId ||
    `${INVALID_ID_PREFIX}${index}`;
  const title = toTrimmedString(article.title) || toTrimmedString(article.brief) || FALLBACK_TITLE;
  const content =
    toTrimmedString(article.brief) || toTrimmedString(article.content) || FALLBACK_CONTENT;
  const image = toTrimmedString(article.cover_image_url ?? article.cover) || null;
  const likes =
    typeof article.like_count === "number"
      ? article.like_count
      : typeof article.likes === "number"
        ? article.likes
        : 0;
  const publishedAt =
    toTrimmedString(article.create_time) ||
    toTrimmedString(article.created_at) ||
    toTrimmedString(article.published_at);

  return {
    id,
    title,
    content,
    image,
    author: resolveAuthorText(article),
    likes,
    publishedAt,
  };
};

const toSearchFallbackPost = (
  item: Record<string, unknown>,
  index: number,
  rawArticleId: string,
): DashboardPost => {
  const safeIdPart = rawArticleId || String(index);
  return {
    id: rawArticleId || `${INVALID_ID_PREFIX}search-${safeIdPart}`,
    title: toTrimmedString(item.title ?? item.h2) || FALLBACK_TITLE,
    content: toTrimmedString(item.snippet ?? item.h2) || FALLBACK_CONTENT,
    image: toTrimmedString(item.cover_image_url ?? item.cover) || null,
    author:
      toTrimmedString(item.author_name ?? item.author) ||
      (rawArticleId ? `用户 ${rawArticleId}` : FALLBACK_AUTHOR),
    likes: 0,
    publishedAt: toTrimmedString(item.create_time),
  };
};

const toRecommendFallbackPost = (id: string, index: number, explanation = ""): DashboardPost => ({
  id: id.trim() || `${INVALID_ID_PREFIX}reco-${index}`,
  title: `推荐结果 ${index + 1}`,
  content: explanation || `推荐编号: ${(id.trim() || String(index)).slice(-8)}`,
  image: null,
  author: FALLBACK_AUTHOR,
  likes: 0,
  publishedAt: "",
});

const buildSearchEvidence = (
  item: Record<string, unknown>,
): NonNullable<DashboardPost["searchEvidence"]> => ({
  chunkId: toTrimmedString(item.chunk_id ?? item.chunkId ?? asRecord(item.hit)?.chunk_id),
  snippet: toTrimmedString(item.snippet ?? item.content ?? asRecord(item.hit)?.snippet),
  typeTags: toTrimmedString(
    item.type_tags ?? item.typeTags ?? item.manual_type_tag ?? item.manualTypeTag,
  ),
  tags: Array.from(
    new Set([
      ...splitTagText(item.tags),
      ...toStringArray(item.secondary_tags),
      ...toStringArray(item.secondaryTags),
    ]),
  ),
  articleScore: toFiniteNumber(item.article_score),
  vectorScore: toFiniteNumber(item.vector_score),
  rerankScore: toFiniteNumber(item.rerank_score),
  matchScore: toFiniteNumber(item.match_score),
});

const withSearchEvidence = (post: DashboardPost, item: Record<string, unknown>): DashboardPost => ({
  ...post,
  searchEvidence: buildSearchEvidence(item),
});

const joinPreviewValues = (values: string[], maxCount = 3): string => {
  const picked = values.slice(0, maxCount);
  return values.length > maxCount
    ? `${picked.join("、")} 等 ${values.length} 项`
    : picked.join("、");
};

const formatLatencyText = (value: unknown): string => {
  const latency = toFiniteNumber(value);
  return latency === null ? "" : `${latency}ms`;
};

const summarizeSearchTraceStep = (
  name: string,
  data: Record<string, unknown>,
): DashboardSearchTraceStageView => {
  switch (name) {
    case "intent.parse":
      return {
        name,
        summary: `识别为 ${toTrimmedString(data.label) || "unknown"} 搜索意图`,
        details: [
          toStringArray(data.keywords).length
            ? `关键词：${toStringArray(data.keywords).join("、")}`
            : "",
          toFiniteNumber(data.confidence) !== null
            ? `置信度 ${((toFiniteNumber(data.confidence) ?? 0) * 100).toFixed(0)}%`
            : "",
          formatLatencyText(data.latency_ms) ? `耗时 ${formatLatencyText(data.latency_ms)}` : "",
        ].filter(Boolean),
      };
    case "assemble.response":
      return {
        name,
        summary: `最终返回 ${toFiniteNumber(data.returned_article_count) ?? 0} 篇内容`,
        details: [
          toStringArray(data.article_ids).length
            ? `文章：${joinPreviewValues(toStringArray(data.article_ids), 3)}`
            : "",
        ].filter(Boolean),
      };
    default:
      return {
        name,
        summary: "",
        details: Object.entries(data)
          .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
          .slice(0, 3)
          .map(([key, value]) =>
            Array.isArray(value)
              ? `${key}: ${joinPreviewValues(toStringArray(value), 2)}`
              : `${key}: ${String(value)}`,
          ),
      };
  }
};

const buildSearchEvidenceViewState = (
  payload: unknown,
  fallbackQuery: string,
): DashboardSearchEvidenceViewState | null => {
  const dataRecord = extractSearchDataRecord(payload);
  if (!dataRecord) {
    return null;
  }

  const intentRecord = asRecord(dataRecord.intent);
  const steps = (Array.isArray(dataRecord.explain_trace) ? dataRecord.explain_trace : [])
    .map((step) => {
      const stepRecord = asRecord(step);
      const name = toTrimmedString(stepRecord?.name);
      const data = asRecord(stepRecord?.data);
      return name && data ? summarizeSearchTraceStep(name, data) : null;
    })
    .filter((item): item is DashboardSearchTraceStageView => Boolean(item));

  return {
    traceId: toTrimmedString(dataRecord.trace_id),
    searchRequestId:
      toTrimmedString(dataRecord.search_request_id) || toTrimmedString(dataRecord.request_id),
    status: toTrimmedString(dataRecord.status) || "ok",
    searchText: toTrimmedString(intentRecord?.search_text) || fallbackQuery,
    intentLabel: toTrimmedString(intentRecord?.label) || "unknown",
    intentConfidence: toFiniteNumber(intentRecord?.confidence),
    keywords: toStringArray(intentRecord?.keywords),
    steps,
  };
};

const toAuthorSearchResult = (
  item: Record<string, unknown>,
  index: number,
): DashboardAuthorSearchResult => {
  const authorId =
    toTrimmedString(item.author_id ?? item.id) || `${INVALID_ID_PREFIX}author-${index}`;
  return {
    id: `${authorId}-${index}`,
    authorId,
    authorName: toTrimmedString(item.author_name) || `作者 ${index + 1}`,
    articleCount: toNumber(item.article_count, 0),
    latestArticleId: toTrimmedString(item.latest_article_id) || undefined,
    latestArticleTitle: toTrimmedString(item.latest_article_title) || undefined,
    latestArticleTime: toTrimmedString(item.latest_article_time) || undefined,
  };
};

const hydrateArticle = async (
  origin: string,
  articleId: string,
  authorization: string | null,
  index: number,
): Promise<{ post: DashboardPost; authorId: string | null } | null> => {
  if (!canFetchArticleDetail(articleId)) {
    return null;
  }

  try {
    const payload = await internalRequest<unknown>(
      origin,
      `${ARTICLE_API_PATHS.getById(articleId)}?incr_view=false`,
      {
        method: "GET",
        headers: buildHeaders(authorization, false),
      },
      { raw: true },
    );
    const article = pickArticleFromPayload(payload);
    if (!article) {
      return null;
    }
    const normalizedArticle = {
      ...article,
      id: article.id ?? article.article_id ?? articleId,
      article_id: article.article_id ?? article.id ?? articleId,
    };
    return {
      post: toDashboardPost(normalizedArticle, index, articleId),
      authorId: toTrimmedString(article.author_id) || null,
    };
  } catch (error) {
    console.warn(`Dashboard feed failed to hydrate article ${articleId}:`, error);
    return null;
  }
};

const loadLatestArticleFallback = async (
  origin: string,
  authorization: string | null,
): Promise<Pick<DashboardFeedResponse, "posts" | "authorIdMap">> => {
  const payload = await internalRequest<unknown>(
    origin,
    `${ARTICLE_API_PATHS.list}?page=1&page_size=20&sort_by=create_time&desc=true`,
    {
      method: "GET",
      headers: buildHeaders(authorization, false),
    },
    { raw: true },
  );
  const articles = pickFirstArray(payload)
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const posts = articles.map((article, index) => toDashboardPost(article, index));
  const authorIdMap = Object.fromEntries(
    articles
      .map((article, index) => [posts[index]?.id, toTrimmedString(article.author_id)])
      .filter(([postId, authorId]) => postId && authorId),
  );
  return { posts, authorIdMap };
};

const buildRecommendPayload = (userId: string, sessionId: string) => ({
  rec_request_id: createRequestId("rec"),
  user_id: userId,
  session_id: sessionId,
  surface: RECOMMEND_SURFACE,
  query: "",
  period_bucket: "d1",
});

const loadRecommendFeed = async ({
  origin,
  authorization,
  sessionId,
  force,
}: {
  origin: string;
  authorization: string | null;
  sessionId: string;
  force: boolean;
}): Promise<DashboardFeedResponse> => {
  const uid = await getCurrentUserId(origin, authorization);
  const userId = uid || `guest:${sessionId}`;
  const cacheKey = `recommend:${userId}`;
  const cached = feedCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.fetchedAt <= RECO_FRESH_TTL_MS) {
    return cached.response;
  }

  const inflight = inflightFeeds.get(cacheKey);
  if (!force && inflight) {
    return inflight;
  }

  const task = (async () => {
    const recommendPayload = buildRecommendPayload(userId, sessionId);
    const payload = await internalRequest<unknown>(origin, RECO_API_PATHS.recommend, {
      method: "POST",
      headers: buildHeaders(null),
      body: JSON.stringify(recommendPayload),
    });
    const recoRecord = extractSearchDataRecord(payload);
    const recRequestId =
      toTrimmedString(recoRecord?.rec_request_id) || recommendPayload.rec_request_id;
    const ids = extractRecommendIds(payload);
    const explanation = toTrimmedString(recoRecord?.explanation);
    const hydrated = await Promise.all(
      ids.map((articleId, index) => hydrateArticle(origin, articleId, authorization, index)),
    );
    const posts: DashboardPost[] = [];
    const authorIdMap: Record<string, string> = {};
    hydrated.forEach((entry) => {
      if (!entry) {
        return;
      }
      posts.push(entry.post);
      if (entry.authorId) {
        authorIdMap[entry.post.id] = entry.authorId;
      }
    });
    if (!posts.length) {
      const fallback = await loadLatestArticleFallback(origin, authorization);
      posts.push(...fallback.posts);
      Object.assign(authorIdMap, fallback.authorIdMap);
    }
    const attachRecommendation = ids.length > 0;
    const response: DashboardFeedResponse = {
      posts:
        posts.length || !ids.length
          ? posts.map((post, index) =>
              attachRecommendation
                ? {
                    ...post,
                    recommendation: {
                      recRequestId,
                      userId,
                      sessionId,
                      surface: RECOMMEND_SURFACE,
                      rank: index + 1,
                    },
                  }
                : post,
            )
          : ids.map((id, index) => ({
              ...toRecommendFallbackPost(id, index, explanation),
              recommendation: {
                recRequestId,
                userId,
                sessionId,
                surface: RECOMMEND_SURFACE,
                rank: index + 1,
              },
            })),
      authorResults: [],
      searchEvidence: null,
      authorIdMap,
      userId,
      sessionId,
      surface: RECOMMEND_SURFACE,
      recRequestId,
      fetchedAt: Date.now(),
    };
    feedCache.set(cacheKey, { response, fetchedAt: response.fetchedAt });
    return response;
  })();

  inflightFeeds.set(cacheKey, task);
  try {
    return await task;
  } finally {
    if (inflightFeeds.get(cacheKey) === task) {
      inflightFeeds.delete(cacheKey);
    }
  }
};

const loadSearchFeed = async ({
  origin,
  authorization,
  mode,
  query,
  sessionId,
}: {
  origin: string;
  authorization: string | null;
  mode: DashboardSearchMode;
  query: string;
  sessionId: string;
}): Promise<DashboardFeedResponse> => {
  if (mode === "author") {
    const payload = await internalRequest<unknown>(
      origin,
      RECO_API_PATHS.searchAuthors,
      {
        method: "POST",
        headers: buildHeaders(null),
        body: JSON.stringify({
          search_request_id: createRequestId("search"),
          query,
          topk: SEARCH_TOP_K,
        }),
      },
      { raw: true },
    );
    return {
      posts: [],
      authorResults: extractAuthorSearchItems(payload).map(toAuthorSearchResult),
      searchEvidence: null,
      authorIdMap: {},
      fetchedAt: Date.now(),
    };
  }

  if (mode === "title") {
    const payload = await internalRequest<unknown>(
      origin,
      RECO_API_PATHS.searchTitle,
      {
        method: "POST",
        headers: buildHeaders(null),
        body: JSON.stringify({
          search_request_id: createRequestId("search"),
          query,
          topk: SEARCH_TOP_K,
        }),
      },
      { raw: true },
    );
    const searchItems = extractSearchItems(payload);
    const posts = searchItems.map((item, index) =>
      withSearchEvidence(toSearchFallbackPost(item, index, pickArticleId(item)), item),
    );
    const authorIdMap = Object.fromEntries(
      posts
        .map((post, index) => [post.id, toTrimmedString(searchItems[index]?.author_id)])
        .filter(([, authorId]) => authorId),
    );
    return {
      posts,
      authorResults: [],
      searchEvidence: null,
      authorIdMap,
      fetchedAt: Date.now(),
    };
  }

  const uid = await getCurrentUserId(origin, authorization);
  const payload = await internalRequest<unknown>(
    origin,
    RECO_API_PATHS.search,
    {
      method: "POST",
      headers: buildHeaders(null),
      body: JSON.stringify({
        search_request_id: createRequestId("search"),
        user_id: uid || `guest:${sessionId}`,
        session_id: sessionId,
        query,
        topk: SEARCH_TOP_K,
        need_answer: false,
        explain: true,
      }),
    },
    { raw: true },
  );
  const searchItems = extractSearchItems(payload);
  const authorIdMap: Record<string, string> = {};
  const resolvedPosts = await Promise.all(
    searchItems.map(async (item, index) => {
      const articleId = pickArticleId(item);
      const hydrated = await hydrateArticle(origin, articleId, authorization, index);
      if (hydrated) {
        if (hydrated.authorId) {
          authorIdMap[hydrated.post.id] = hydrated.authorId;
        }
        return withSearchEvidence(hydrated.post, item);
      }
      return withSearchEvidence(toSearchFallbackPost(item, index, articleId), item);
    }),
  );

  return {
    posts: resolvedPosts,
    authorResults: [],
    searchEvidence: buildSearchEvidenceViewState(payload, query),
    authorIdMap,
    fetchedAt: Date.now(),
  };
};

const buildFeedResponse = async (
  request: NextRequest,
  body: DashboardFeedRequest,
): Promise<DashboardFeedResponse> => {
  const tabSlug = normalizeTabSlug(body.tabSlug);
  const mode = normalizeSearchMode(body.mode);
  const normalizedQuery = toTrimmedString(body.query);
  const presetTabQuery =
    tabSlug === DEFAULT_DASHBOARD_TAB || normalizedQuery
      ? ""
      : buildDashboardTabSearchText(tabSlug);
  const effectiveQuery = (
    mode === "content" ? normalizedQuery || presetTabQuery : normalizedQuery
  ).trim();
  const authorization = request.headers.get("authorization");
  const sessionId = normalizeSessionId(body.sessionId);
  const origin = getInternalOrigin(request);

  if (effectiveQuery) {
    return loadSearchFeed({
      origin,
      authorization,
      mode,
      query: effectiveQuery,
      sessionId,
    });
  }

  return loadRecommendFeed({
    origin,
    authorization,
    sessionId,
    force: Boolean(body.force),
  });
};

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json()) as DashboardFeedRequest;
    const response = await buildFeedResponse(request, body);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to build dashboard feed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dashboard feed failed" },
      { status: 500 },
    );
  }
}
