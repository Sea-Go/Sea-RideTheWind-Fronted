export interface DashboardSearchEvidence {
  chunkId?: string;
  snippet?: string;
  typeTags?: string;
  tags?: string[];
  articleScore?: number | null;
  vectorScore?: number | null;
  rerankScore?: number | null;
  matchScore?: number | null;
}

export type DashboardSearchMode = "content" | "title" | "author";

export interface DashboardPost {
  id: string;
  title: string;
  image: string | null;
  author: string;
  likes: number;
  content: string;
  publishedAt: string;
  searchEvidence?: DashboardSearchEvidence | null;
}

export interface DashboardAuthorSearchResult {
  id: string;
  authorId: string;
  authorName: string;
  articleCount: number;
  latestArticleId?: string;
  latestArticleTitle?: string;
  latestArticleTime?: string;
}

export interface DashboardSearchTraceStageView {
  name: string;
  summary: string;
  details: string[];
}

export interface DashboardSearchEvidenceViewState {
  traceId: string;
  searchRequestId: string;
  status: string;
  searchText: string;
  intentLabel: string;
  intentConfidence: number | null;
  keywords: string[];
  steps: DashboardSearchTraceStageView[];
}

export interface DashboardFeedRequest {
  tabSlug?: string;
  query?: string;
  mode?: DashboardSearchMode;
  force?: boolean;
  sessionId?: string;
}

export interface DashboardFeedResponse {
  posts: DashboardPost[];
  authorResults: DashboardAuthorSearchResult[];
  searchEvidence: DashboardSearchEvidenceViewState | null;
  authorIdMap: Record<string, string>;
  fetchedAt: number;
}
