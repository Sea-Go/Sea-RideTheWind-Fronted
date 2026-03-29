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

export interface ContentSearchPayload {
  search_request_id: string;
  user_id: string;
  session_id: string;
  query: string;
  topk: number;
  need_answer?: boolean;
  explain: boolean;
}

export interface StructuredSearchPayload {
  search_request_id: string;
  query: string;
  topk: number;
}

export interface OnboardingQuestionnairePayload {
  user_id: string;
  username?: string;
  interests: string[];
  primary_purpose: string;
  preferred_article_types: string[];
  preferred_article_length: string;
  preferred_style: string;
  backgrounds: string[];
  difficulty_preference: string;
  excluded_contents?: string[];
  reading_time_slots?: string[];
  personalized_recommendation_types: string[];
}

export interface OnboardingQuestionnaireResponse {
  trace_id?: string;
  status?: string;
  user_id?: string;
  period_bucket?: string;
  memory_types?: string[];
  updated_at?: string;
  warnings?: string[];
}

export interface SearchRecoHit {
  article_id?: string | number;
  id?: string | number;
  target_id?: string | number;
  author_id?: string | number;
  author_name?: string;
  title?: string;
  brief?: string;
  cover?: string;
  manual_type_tag?: string;
  secondary_tags?: string[];
  snippet?: string;
  chunk_id?: string;
  type_tags?: string;
  tags?: string;
  article_score?: number;
  vector_score?: number;
  rerank_score?: number;
  match_score?: number;
  [key: string]: unknown;
}

export interface SearchRecoAuthorHit {
  author_id?: string | number;
  author_name?: string;
  article_count?: number;
  latest_article_id?: string | number;
  latest_article_title?: string;
  latest_article_time?: string;
  [key: string]: unknown;
}

export interface SearchExplainTraceItem {
  name?: string;
  data?: Record<string, unknown>;
}

export interface SearchRecoData {
  trace_id?: string;
  request_id?: string;
  search_request_id?: string;
  status?: string;
  answer?: string;
  intent?: Record<string, unknown>;
  hits?: SearchRecoHit[];
  items?: SearchRecoHit[];
  explanation?: string;
  explain_trace?: SearchExplainTraceItem[];
  debug?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SearchRecoArticleData {
  trace_id?: string;
  request_id?: string;
  search_request_id?: string;
  status?: string;
  items?: SearchRecoHit[];
  [key: string]: unknown;
}

export interface SearchRecoAuthorData {
  trace_id?: string;
  request_id?: string;
  search_request_id?: string;
  status?: string;
  authors?: SearchRecoAuthorHit[];
  [key: string]: unknown;
}

export interface SearchResponse {
  code?: number;
  msg?: string;
  data?: SearchRecoData;
  [key: string]: unknown;
}

export interface SearchArticleResponse {
  code?: number;
  msg?: string;
  data?: SearchRecoArticleData;
  [key: string]: unknown;
}

export interface SearchAuthorResponse {
  code?: number;
  msg?: string;
  data?: SearchRecoAuthorData;
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

export const searchRecoByContent = (payload: ContentSearchPayload): Promise<SearchResponse> =>
  request<SearchResponse>(RECO_API_PATHS.search, {
    method: "POST",
    body: JSON.stringify(payload),
    responseMode: "raw",
  });

export const searchRecoByTitle = (
  payload: StructuredSearchPayload,
): Promise<SearchArticleResponse> =>
  request<SearchArticleResponse>(RECO_API_PATHS.searchTitle, {
    method: "POST",
    body: JSON.stringify(payload),
    responseMode: "raw",
  });

export const searchRecoByAuthor = (
  payload: StructuredSearchPayload,
): Promise<SearchAuthorResponse> =>
  request<SearchAuthorResponse>(RECO_API_PATHS.searchAuthors, {
    method: "POST",
    body: JSON.stringify(payload),
    responseMode: "raw",
  });

export const submitOnboardingQuestionnaire = (
  payload: OnboardingQuestionnairePayload,
): Promise<OnboardingQuestionnaireResponse> =>
  request<OnboardingQuestionnaireResponse>(RECO_API_PATHS.onboardingQuestionnaire, {
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
