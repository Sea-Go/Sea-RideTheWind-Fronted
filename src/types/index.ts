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
