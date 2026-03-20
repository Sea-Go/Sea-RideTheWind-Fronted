import { recommendArticles, type RecommendArticlesPayload } from "@/services/reco";

export const RECO_FRESH_TTL_MS = 5 * 60 * 1000;
export const RECO_STALE_TTL_MS = 24 * 60 * 60 * 1000;

const RECO_SESSION_STORAGE_KEY = "dashboard_reco_session_id";
const RECO_STORAGE_PREFIX = "dashboard_reco_snapshot:";

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

export interface RecommendRequestInput {
  userId: string;
  userKey: string;
  sessionId: string;
  surface: string;
  query?: string;
  periodBucket?: string;
}

const memorySnapshots = new Map<string, RecommendSnapshot>();
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

const saveSnapshot = (snapshot: RecommendSnapshot): RecommendSnapshot => {
  memorySnapshots.set(snapshot.userKey, snapshot);
  saveSnapshotToStorage(snapshot);
  return snapshot;
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

  const ids = normalizeIds(dataRecord.ids);
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

export const fetchRecommendSnapshot = async (
  input: RecommendRequestInput,
): Promise<RecommendSnapshot | null> => {
  const normalizedKey = input.userKey.trim();
  if (!normalizedKey) {
    return null;
  }

  const inflight = inflightSnapshots.get(normalizedKey);
  if (inflight) {
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
    inflightSnapshots.delete(normalizedKey);
  }
};
