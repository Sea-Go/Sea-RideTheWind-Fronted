import { ARTICLE_API_PATHS, RECO_API_PATHS } from "@/constants/api-paths";
import type { ArticleItem, ArticleListResponse } from "@/services/article";
import { getAuthToken } from "@/services/auth";
import { request, withBearerAuthorization } from "@/services/request";

import type { Citation, KnowledgeModule, ReleaseState, SearchResult, Story } from "./types";
export function seaRequest<T>(path: string, init: RequestInit = {}) {
  const token = getAuthToken();
  return request<T>(`/api/sea/${path}`, {
    ...init,
    headers: token ? withBearerAuthorization(token, init.headers) : init.headers,
  });
}
export function mapArticle(a: ArticleItem): Story {
  return {
    id: String(a.article_id ?? a.id),
    title: a.title || "无标题文章",
    brief: a.brief || "这篇文章暂未提供摘要。",
    author: a.author_name || a.username || "社区作者",
    topic: a.manual_type_tag || "社区",
    image: "mountain",
    likes: a.like_count ?? a.likes,
    comments: a.comment_count,
  };
}
export async function communityPage(
  page: number,
  signal: AbortSignal,
): Promise<{ items: Story[]; hasMore: boolean }> {
  const result = await request<ArticleListResponse>(
    `${ARTICLE_API_PATHS.list}?page=${page}&page_size=8&sort_by=create_time&desc=true`,
    { signal },
  );
  const items = result.list ?? result.articles ?? result.items ?? result.records ?? [];
  // The article list endpoint has no status filter yet. Keep review drafts and
  // withdrawn articles out of the public feed while paging by upstream rows.
  return {
    items: items.filter((article) => article.status === 2).map(mapArticle),
    hasMore: items.length === 8 && (result.total === undefined || page * 8 < result.total),
  };
}
export function knowledgePage(cursor: string | undefined, signal: AbortSignal) {
  return seaRequest<{ items: KnowledgeModule[]; next_cursor?: string }>(
    `knowledge/modules?limit=12${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    { signal },
  );
}
export function searchKnowledge(
  query: string,
  depth: string,
  intelligence: string,
  signal: AbortSignal,
) {
  return seaRequest<SearchResult>("intelligence/search", {
    method: "POST",
    signal,
    body: JSON.stringify({
      query,
      depth,
      intelligence,
      delivery: "summary",
      limit: 12,
      client_request_id: crypto.randomUUID(),
    }),
  });
}
export function suggest(query: string, signal: AbortSignal) {
  return request<{ items?: { title?: string }[] }>(RECO_API_PATHS.searchTitle, {
    method: "POST",
    signal,
    body: JSON.stringify({ search_request_id: crypto.randomUUID(), query, topk: 5 }),
  });
}
export async function activateKnowledge(moduleId: string, state: ReleaseState, reason: string) {
  return seaRequest<ReleaseState>(`knowledge/modules/${encodeURIComponent(moduleId)}/activation`, {
    method: "PUT",
    body: JSON.stringify({
      release_id: state.candidate_release_id,
      build_id: state.build_id,
      expected_pointer_revision: state.pointer_revision,
      reason,
    }),
  });
}
export interface StreamEvent {
  type:
    | "answer.started"
    | "answer.delta"
    | "answer.citation"
    | "answer.completed"
    | "answer.failed";
  answer_id?: string;
  delta?: string;
  citation?: Citation;
  status?: SearchResult["status"];
  message?: string;
}
// Incremental SSE decoding, UTF-8 chunk boundaries and CRLF are preserved. No whole-body buffering or implicit regeneration.
export async function readEventStream(
  response: Response,
  receive: (event: StreamEvent) => void,
  signal: AbortSignal,
) {
  if (!response.ok) throw new Error(`生成请求失败 (${response.status})`);
  if (!response.body) throw new Error("服务未返回可读取的数据流");
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const decoder = new TextDecoder();
  let pending = "";
  const flush = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (data && data !== "[DONE]") receive(JSON.parse(data) as StreamEvent);
  };
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("已停止", "AbortError");
      const { value, done } = await reader.read();
      if (signal.aborted) throw new DOMException("已停止", "AbortError");
      if (done) {
        pending += decoder.decode();
        if (pending.trim()) flush(pending);
        break;
      }
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 1048576) throw new Error("单个流事件超过 1 MiB 限制");
      let match;
      while ((match = /\r?\n\r?\n/.exec(pending))) {
        flush(pending.slice(0, match.index));
        pending = pending.slice(match.index + match[0].length);
      }
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function streamAnswer(
  conversationId: string,
  question: string,
  requestId: string,
  signal: AbortSignal,
  receive: (event: StreamEvent) => void,
) {
  const token = getAuthToken();
  const response = await fetch(
    `/api/sea/learning/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      signal,
      headers: token
        ? withBearerAuthorization(token, {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          })
        : { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        question,
        client_request_id: requestId,
        depth: "detailed",
        intelligence: "medium",
      }),
    },
  );
  await readEventStream(response, receive, signal);
}

export function citationPath(c: Citation): string | null {
  if (c.kind === "article" || !c.module_id || !c.revision_id) return null;
  const path = c.kind === "source" ? "sources" : "read";
  return `/knowledge/${encodeURIComponent(c.module_id)}/${path}?release=${encodeURIComponent(c.release)}&revision=${encodeURIComponent(c.revision_id)}&locator=${encodeURIComponent(c.locator)}`;
}
