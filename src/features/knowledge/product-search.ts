import { getAuthToken } from "@/services/auth";
import { withBearerAuthorization } from "@/services/request";

import type { ProductSearchReq, ProductSearchResult } from "./generated/knowledgeComponents";

export type SearchDepth = "fast" | "detailed";
export type SearchIntelligence = "low" | "medium" | "high";
export type ProductSearchInput = Pick<ProductSearchReq, "module_id" | "query"> & {
  depth: SearchDepth;
  intelligence: SearchIntelligence;
};
export type SearchOperation = {
  input: ProductSearchInput;
  idempotencyKey: string;
  searchId: string;
};
export type SearchResponse = {
  httpStatus: 200 | 202 | 503;
  result: ProductSearchResult & {
    status: "succeeded" | "insufficient" | "in_flight" | "retryable_failure";
  };
};

export class SearchKeyConflict extends Error {}

const part = encodeURIComponent;
const searchPath = (sessionId: string) =>
  `/api/sea/knowledge/answer-sessions/${part(sessionId)}/searches`;

export function newSearchOperation(input: ProductSearchInput): SearchOperation {
  const moduleId = input.module_id.trim();
  const query = input.query.trim();
  if (!moduleId || !query) throw new Error("请选择知识模块并输入问题。");
  return {
    input: { module_id: moduleId, query, depth: input.depth, intelligence: input.intelligence },
    idempotencyKey: crypto.randomUUID(),
    searchId: "",
  };
}

async function requestSearch(url: string, init: RequestInit): Promise<SearchResponse> {
  const token = getAuthToken();
  if (!token) throw new Error("请先登录，再搜索知识。");
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: withBearerAuthorization(token, { "Content-Type": "application/json" }),
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("搜索服务返回了无法读取的结果；请用原请求重试。");
  }
  const envelope = payload as { code?: unknown; msg?: unknown; data?: unknown } | null;
  const message = typeof envelope?.msg === "string" ? envelope.msg : "搜索暂不可用";
  if (![200, 202, 503].includes(response.status) || envelope?.code !== response.status) {
    if (response.status === 409)
      throw new SearchKeyConflict("此幂等键已绑定其他搜索内容。请新建一次搜索。");
    throw new Error(message);
  }
  const result = envelope.data as ProductSearchResult | null;
  if (
    !result ||
    typeof result.search_id !== "string" ||
    !result.search_id ||
    typeof result.answer_id !== "string" ||
    !result.answer_id ||
    !Array.isArray(result.citations)
  )
    throw new Error("搜索操作未返回固定身份；请用原请求重试。");
  const status = result.status;
  if (
    (response.status === 202 && status !== "in_flight") ||
    (response.status === 503 && status !== "retryable_failure") ||
    (response.status === 200 &&
      !["succeeded", "insufficient", "retryable_failure"].includes(status)) ||
    (status === "succeeded" && (!result.answer?.trim() || result.citations.length === 0)) ||
    (status === "insufficient" && (result.answer || result.citations.length > 0))
  )
    throw new Error("搜索状态与已接纳结果不一致；请回查固定操作。");
  return {
    httpStatus: response.status as SearchResponse["httpStatus"],
    result: result as SearchResponse["result"],
  };
}

export const knowledgeProductSearch = {
  create: (sessionId: string, operation: SearchOperation, signal?: AbortSignal) =>
    requestSearch(searchPath(sessionId), {
      method: "POST",
      body: JSON.stringify({
        module_id: operation.input.module_id,
        query: operation.input.query,
        depth: operation.input.depth,
        intelligence: operation.input.intelligence,
        idempotency_key: operation.idempotencyKey,
      }),
      signal,
    }),
  get: (sessionId: string, searchId: string, signal?: AbortSignal) =>
    requestSearch(`${searchPath(sessionId)}/${part(searchId)}`, { method: "GET", signal }),
};

const storageKey = (sessionId: string) => `sea:knowledge-search:${sessionId}`;
const authMarker = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export async function saveSearchOperation(
  sessionId: string,
  token: string,
  operation: SearchOperation,
) {
  try {
    sessionStorage.setItem(
      storageKey(sessionId),
      JSON.stringify({ ...operation, authMarker: await authMarker(token) }),
    );
  } catch {
    // Storage is optional; the in-memory operation still keeps the key for retries.
  }
}

export async function loadSearchOperation(
  sessionId: string,
  token: string,
): Promise<SearchOperation | null> {
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SearchOperation & { authMarker?: string };
    if (saved.authMarker !== (await authMarker(token))) return null;
    if (
      !saved.input ||
      !saved.input.module_id ||
      !saved.input.query ||
      !["fast", "detailed"].includes(saved.input.depth) ||
      !["low", "medium", "high"].includes(saved.input.intelligence) ||
      !/^[A-Za-z0-9_.-]{8,128}$/.test(saved.idempotencyKey) ||
      typeof saved.searchId !== "string"
    )
      return null;
    return { input: saved.input, idempotencyKey: saved.idempotencyKey, searchId: saved.searchId };
  } catch {
    return null;
  }
}

export function clearSearchOperation(sessionId: string) {
  try {
    sessionStorage.removeItem(storageKey(sessionId));
  } catch {
    // Storage may be unavailable in private browsing.
  }
}
