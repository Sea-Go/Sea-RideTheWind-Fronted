import { RECO_API_PATHS } from "@/constants/api-paths";
import { request } from "@/services/request";

export interface RecommendArticlesPayload {
  rec_request_id?: string;
  user_id: string;
  session_id?: string;
  surface: string;
  query?: string;
  period_bucket?: string;
}

export type RecommendArticlesResponse = Record<string, unknown>;

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
