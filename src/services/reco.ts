import { RECO_API_PATHS } from "@/constants/api-paths";
import { request } from "@/services/request";

export interface RecommendArticlesPayload {
  rec_request_id: string;
  user_id: string;
  session_id: string;
  surface: string;
  query: string;
  period_bucket: string;
}

export interface RecommendArticleItem {
  article_id?: string | number;
  id?: string | number;
  target_id?: string | number;
  [key: string]: unknown;
}

export interface RecommendArticlesResponse {
  trace_id?: string;
  rec_request_id?: string;
  status?: string;
  ids?: string[];
  explanation?: string;
  data?: RecommendArticlesResponse;
  list?: RecommendArticleItem[];
  articles?: RecommendArticleItem[];
  items?: RecommendArticleItem[];
  [key: string]: unknown;
}

export interface SearchPayload {
  request_id: string;
  user_id: string;
  session_id: string;
  query: string;
  top_k: number;
  need_answer: boolean;
  explain: boolean;
}

export interface SearchRecoHit {
  article_id?: string | number;
  id?: string | number;
  target_id?: string | number;
  [key: string]: unknown;
}

export interface SearchRecoData {
  trace_id?: string;
  request_id?: string;
  search_request_id?: string;
  status?: string;
  answer?: string;
  hits?: SearchRecoHit[];
  items?: SearchRecoHit[];
  explanation?: string;
  debug?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SearchResponse {
  code?: number;
  msg?: string;
  data?: SearchRecoData;
  [key: string]: unknown;
}

export interface IngestDocumentPayload {
  article_id: string;
  score: number;
  markdown: string;
}

export interface IngestDocumentResponse {
  article_id: string;
  coarse_vector_inserted: boolean;
  fine_vector_inserted: number;
  fine_chunk_count: number;
  graph_enabled: boolean;
  graph_write_ok: boolean;
}

export interface RecoToolsResponse {
  tools: string[];
}

export interface RecoHealthResponse {
  status: string;
}

export const recommendArticles = (
  payload: RecommendArticlesPayload,
): Promise<RecommendArticlesResponse> =>
  request<RecommendArticlesResponse>(RECO_API_PATHS.recommend, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const searchReco = (payload: SearchPayload): Promise<SearchResponse> =>
  request<SearchResponse>(RECO_API_PATHS.search, {
    method: "POST",
    body: JSON.stringify(payload),
    responseMode: "raw",
  });

export const ingestDocument = (payload: IngestDocumentPayload): Promise<IngestDocumentResponse> =>
  request<IngestDocumentResponse>(RECO_API_PATHS.ingest, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listRecoTools = (): Promise<RecoToolsResponse> =>
  request<RecoToolsResponse>(RECO_API_PATHS.tools, {
    method: "GET",
  });

export const getRecoHealth = (): Promise<RecoHealthResponse> =>
  request<RecoHealthResponse>(RECO_API_PATHS.health, {
    method: "GET",
  });
