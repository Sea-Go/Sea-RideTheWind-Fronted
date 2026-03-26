import type { DashboardPost } from "@/types";

import { recommendArticles, type RecommendArticlesPayload } from "@/services/reco";

export const RECO_FRESH_TTL_MS = 5 * 60 * 1000;
export const RECO_STALE_TTL_MS = 24 * 60 * 60 * 1000;

const RECO_SESSION_STORAGE_KEY = "dashboard_reco_session_id";
const RECO_STORAGE_PREFIX = "dashboard_reco_snapshot:";
const RECO_VIEW_STORAGE_PREFIX = "dashboard_reco_view:";

type SnapshotFreshness = "fresh" | "stale" | "expired" | "miss";

export interface RecommendSnapshot {
  ids: string[];
  explanation?: string;
  fetchedAt: number;
  userKey: string;
  recRequestId?: string;
  traceId?: string;
  status?: string;
}

export interface RecommendSnapshotCacheResult {
  snapshot: RecommendSnapshot | null;
  freshness: SnapshotFreshness;
}

export interface RecommendViewCache {
  ids: string[];
  posts: DashboardPost[];
  fetchedAt: number;
  userKey: string;
  authorIdMap: Record<string, string>;
  explanation?: string;
  recRequestId?: string;
  traceId?: string;
  status?: string;
}

export interface RecommendViewCacheResult {
  view: RecommendViewCache | null;
  freshness: SnapshotFreshness;
}

export interface RecommendRequestInput {
  userId: string;
  userKey: string;
  sessionId: string;
  surface: string;
  query?: string;
  periodBucket?: string;
}

export interface FetchRecommendSnapshotOptions {
  force?: boolean;
}

const memorySnapshots = new Map<string, RecommendSnapshot>();
const memoryViews = new Map<string, RecommendViewCache>();
const inflightSnapshots = new Map<string, Promise<RecommendSnapshot | null>>();

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const normalizeIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (item === undefined || item === null ? "" : String(item).trim()))
    .filter((id): id is string => Boolean(id));
};

const normalizeString = (value: unknown): string =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const normalizeAuthorIdMap = (value: unknown): Record<string, string> => {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  const next: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(record)) {
    const normalizedKey = key.trim();
    const normalizedValue =
      rawValue === undefined || rawValue === null ? "" : String(rawValue).trim();
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    next[normalizedKey] = normalizedValue;
  }
  return next;
};

const normalizeDashboardPosts = (value: unknown): DashboardPost[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const posts: DashboardPost[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const id = normalizeString(record.id);
    const title = normalizeString(record.title);
    const content = normalizeString(record.content);
    const author = normalizeString(record.author);
    if (!id || !title || !content || !author) {
      continue;
    }

    const image = normalizeString(record.image);
    const publishedAt = normalizeString(record.publishedAt);
    const likes = Number(record.likes);

    posts.push({
      id,
      title,
      content,
      author,
      image: image || null,
      publishedAt,
      likes: Number.isFinite(likes) ? likes : 0,
    });
  }

  return posts;
};

const resolveFreshness = (snapshot: RecommendSnapshot, now: number): SnapshotFreshness => {
  const ageMs = now - snapshot.fetchedAt;
  if (ageMs <= RECO_FRESH_TTL_MS) {
    return "fresh";
  }
  if (ageMs <= RECO_STALE_TTL_MS) {
    return "stale";
  }
  return "expired";
};

const buildStorageKey = (userKey: string): string =>
  `${RECO_STORAGE_PREFIX}${encodeURIComponent(userKey)}`;

const buildViewStorageKey = (userKey: string): string =>
  `${RECO_VIEW_STORAGE_PREFIX}${encodeURIComponent(userKey)}`;

const saveSnapshotToStorage = (snapshot: RecommendSnapshot): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(buildStorageKey(snapshot.userKey), JSON.stringify(snapshot));
  } catch (error) {
    console.warn("Failed to save recommend snapshot cache:", error);
  }
};

const removeSnapshotFromStorage = (userKey: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(buildStorageKey(userKey));
  } catch (error) {
    console.warn("Failed to remove recommend snapshot cache:", error);
  }
};

const saveViewToStorage = (view: RecommendViewCache): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(buildViewStorageKey(view.userKey), JSON.stringify(view));
  } catch (error) {
    console.warn("Failed to save recommend view cache:", error);
  }
};

const removeViewFromStorage = (userKey: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(buildViewStorageKey(userKey));
  } catch (error) {
    console.warn("Failed to remove recommend view cache:", error);
  }
};

const readSnapshotFromStorage = (userKey: string): RecommendSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    if (!record) {
      return null;
    }

    const ids = normalizeIds(record.ids);
    const fetchedAt = Number(record.fetchedAt);
    const normalizedUserKey =
      typeof record.userKey === "string" && record.userKey.trim() ? record.userKey.trim() : userKey;
    const explanation =
      typeof record.explanation === "string" && record.explanation.trim()
        ? record.explanation.trim()
        : undefined;
    const recRequestId =
      typeof record.recRequestId === "string" && record.recRequestId.trim()
        ? record.recRequestId.trim()
        : undefined;
    const traceId =
      typeof record.traceId === "string" && record.traceId.trim()
        ? record.traceId.trim()
        : undefined;
    const status =
      typeof record.status === "string" && record.status.trim() ? record.status.trim() : undefined;

    if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
      return null;
    }

    return {
      ids,
      explanation,
      fetchedAt,
      userKey: normalizedUserKey,
      recRequestId,
      traceId,
      status,
    };
  } catch (error) {
    console.warn("Failed to read recommend snapshot cache:", error);
    return null;
  }
};

const readViewFromStorage = (userKey: string): RecommendViewCache | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildViewStorageKey(userKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    if (!record) {
      return null;
    }

    const ids = normalizeIds(record.ids);
    const posts = normalizeDashboardPosts(record.posts);
    const fetchedAt = Number(record.fetchedAt);
    const normalizedUserKey =
      typeof record.userKey === "string" && record.userKey.trim() ? record.userKey.trim() : userKey;
    const explanation =
      typeof record.explanation === "string" && record.explanation.trim()
        ? record.explanation.trim()
        : undefined;
    const recRequestId =
      typeof record.recRequestId === "string" && record.recRequestId.trim()
        ? record.recRequestId.trim()
        : undefined;
    const traceId =
      typeof record.traceId === "string" && record.traceId.trim()
        ? record.traceId.trim()
        : undefined;
    const status =
      typeof record.status === "string" && record.status.trim() ? record.status.trim() : undefined;
    const authorIdMap = normalizeAuthorIdMap(record.authorIdMap);

    if (!Number.isFinite(fetchedAt) || fetchedAt <= 0 || !posts.length) {
      return null;
    }

    return {
      ids,
      posts,
      fetchedAt,
      userKey: normalizedUserKey,
      authorIdMap,
      explanation,
      recRequestId,
      traceId,
      status,
    };
  } catch (error) {
    console.warn("Failed to read recommend view cache:", error);
    return null;
  }
};

const saveSnapshot = (snapshot: RecommendSnapshot): RecommendSnapshot => {
  memorySnapshots.set(snapshot.userKey, snapshot);
  saveSnapshotToStorage(snapshot);
  return snapshot;
};

const saveView = (view: RecommendViewCache): RecommendViewCache => {
  memoryViews.set(view.userKey, view);
  saveViewToStorage(view);
  return view;
};

const collectRecommendIdCandidates = (record: Record<string, unknown>): string[] => {
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

  return values
    .map((value) => (value === undefined || value === null ? "" : String(value).trim()))
    .filter((value): value is string => Boolean(value));
};

const extractIdsFromItemArray = (items: unknown[]): string[] => {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const id = collectRecommendIdCandidates(record)[0] ?? "";
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    ids.push(id);
  }

  return ids;
};

const extractRecommendIds = (value: unknown): string[] => {
  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const directIds = normalizeIds(record.ids);
  if (directIds.length) {
    return directIds;
  }

  const compatIds = normalizeIds(record.article_ids);
  if (compatIds.length) {
    return compatIds;
  }

  const arrayKeys = ["list", "articles", "items", "records", "rows", "hits", "ranked"] as const;
  for (const key of arrayKeys) {
    const candidate = record[key];
    if (!Array.isArray(candidate)) {
      continue;
    }

    const ids = extractIdsFromItemArray(candidate);
    if (ids.length) {
      return ids;
    }
  }

  if (record.data) {
    return extractRecommendIds(record.data);
  }

  return [];
};

const resolveRecommendData = (payload: unknown): Record<string, unknown> | null => {
  const payloadRecord = asRecord(payload);
  if (!payloadRecord) {
    return null;
  }

  const nestedData = asRecord(payloadRecord.data);
  return nestedData ?? payloadRecord;
};

const toRecommendSnapshot = (payload: unknown, userKey: string): RecommendSnapshot | null => {
  const dataRecord = resolveRecommendData(payload);
  if (!dataRecord) {
    return null;
  }

  const ids = extractRecommendIds(dataRecord);
  const explanation =
    typeof dataRecord.explanation === "string" && dataRecord.explanation.trim()
      ? dataRecord.explanation.trim()
      : undefined;
  const recRequestId =
    typeof dataRecord.rec_request_id === "string" && dataRecord.rec_request_id.trim()
      ? dataRecord.rec_request_id.trim()
      : undefined;
  const traceId =
    typeof dataRecord.trace_id === "string" && dataRecord.trace_id.trim()
      ? dataRecord.trace_id.trim()
      : undefined;
  const status =
    typeof dataRecord.status === "string" && dataRecord.status.trim()
      ? dataRecord.status.trim()
      : undefined;

  return {
    ids,
    explanation,
    fetchedAt: Date.now(),
    userKey,
    recRequestId,
    traceId,
    status,
  };
};

const createRecoRequestId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `rec_${Date.now()}_${randomPart}`;
};

const buildRecommendPayload = (input: RecommendRequestInput): RecommendArticlesPayload => ({
  rec_request_id: createRecoRequestId(),
  user_id: input.userId,
  session_id: input.sessionId,
  surface: input.surface,
  query: input.query ?? "",
  period_bucket: input.periodBucket ?? "d1",
});

export const buildGuestRecoUserId = (sessionId: string): string => `guest:${sessionId}`;

export const buildUserRecoKey = (userId: string): string => {
  const normalized = userId.trim();
  return normalized.startsWith("guest:") ? normalized : `user:${normalized}`;
};

export const getOrCreateRecoSessionId = (): string => {
  if (typeof window === "undefined") {
    return "dashboard-reco-server-session";
  }

  try {
    const current = window.sessionStorage.getItem(RECO_SESSION_STORAGE_KEY);
    if (current) {
      return current;
    }

    const next =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(RECO_SESSION_STORAGE_KEY, next);
    return next;
  } catch (error) {
    console.warn("Failed to access sessionStorage for recommend session:", error);
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

export const readRecommendSnapshotCache = (userKey: string): RecommendSnapshotCacheResult => {
  const normalizedUserKey = userKey.trim();
  if (!normalizedUserKey) {
    return { snapshot: null, freshness: "miss" };
  }

  const now = Date.now();
  const memorySnapshot = memorySnapshots.get(normalizedUserKey);
  if (memorySnapshot) {
    const freshness = resolveFreshness(memorySnapshot, now);
    if (freshness === "expired") {
      memorySnapshots.delete(normalizedUserKey);
      removeSnapshotFromStorage(normalizedUserKey);
      return { snapshot: null, freshness };
    }
    return { snapshot: memorySnapshot, freshness };
  }

  const localSnapshot = readSnapshotFromStorage(normalizedUserKey);
  if (!localSnapshot) {
    return { snapshot: null, freshness: "miss" };
  }

  const freshness = resolveFreshness(localSnapshot, now);
  if (freshness === "expired") {
    memorySnapshots.delete(normalizedUserKey);
    removeSnapshotFromStorage(normalizedUserKey);
    return { snapshot: null, freshness };
  }

  memorySnapshots.set(normalizedUserKey, localSnapshot);
  return { snapshot: localSnapshot, freshness };
};

export const readRecommendViewCache = (userKey: string): RecommendViewCacheResult => {
  const normalizedUserKey = userKey.trim();
  if (!normalizedUserKey) {
    return { view: null, freshness: "miss" };
  }

  const now = Date.now();
  const memoryView = memoryViews.get(normalizedUserKey);
  if (memoryView) {
    const freshness = resolveFreshness(memoryView, now);
    if (freshness === "expired") {
      memoryViews.delete(normalizedUserKey);
      removeViewFromStorage(normalizedUserKey);
      return { view: null, freshness };
    }
    return { view: memoryView, freshness };
  }

  const localView = readViewFromStorage(normalizedUserKey);
  if (!localView) {
    return { view: null, freshness: "miss" };
  }

  const freshness = resolveFreshness(localView, now);
  if (freshness === "expired") {
    memoryViews.delete(normalizedUserKey);
    removeViewFromStorage(normalizedUserKey);
    return { view: null, freshness };
  }

  memoryViews.set(normalizedUserKey, localView);
  return { view: localView, freshness };
};

export const saveRecommendViewCache = (
  snapshot: RecommendSnapshot,
  posts: DashboardPost[],
  authorIdMap: Record<string, string>,
): RecommendViewCache | null => {
  const normalizedUserKey = snapshot.userKey.trim();
  const normalizedPosts = normalizeDashboardPosts(posts);
  if (!normalizedUserKey || !normalizedPosts.length) {
    return null;
  }

  return saveView({
    ids: snapshot.ids,
    posts: normalizedPosts,
    fetchedAt: Date.now(),
    userKey: normalizedUserKey,
    authorIdMap: normalizeAuthorIdMap(authorIdMap),
    explanation: snapshot.explanation,
    recRequestId: snapshot.recRequestId,
    traceId: snapshot.traceId,
    status: snapshot.status,
  });
};

export const fetchRecommendSnapshot = async (
  input: RecommendRequestInput,
  options?: FetchRecommendSnapshotOptions,
): Promise<RecommendSnapshot | null> => {
  const normalizedKey = input.userKey.trim();
  if (!normalizedKey) {
    return null;
  }

  const force = options?.force ?? false;
  const inflight = inflightSnapshots.get(normalizedKey);
  if (!force && inflight) {
    return inflight;
  }

  const task = (async () => {
    const payload = buildRecommendPayload(input);
    const result = await recommendArticles(payload);
    const snapshot = toRecommendSnapshot(result, normalizedKey);
    if (!snapshot) {
      return null;
    }
    return saveSnapshot(snapshot);
  })();

  inflightSnapshots.set(normalizedKey, task);
  try {
    return await task;
  } finally {
    if (inflightSnapshots.get(normalizedKey) === task) {
      inflightSnapshots.delete(normalizedKey);
    }
  }
};
