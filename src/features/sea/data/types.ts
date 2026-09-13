export type Theme = "mountain" | "planetarium" | "summer";
export interface Story {
  id: string;
  title: string;
  brief: string;
  author: string;
  topic: string;
  image: string;
  readTime?: string;
  likes?: number;
  comments?: number;
}
export interface KnowledgeModule {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  image: string;
  sources: number;
  pages: number;
  release: string;
  updated: string;
  description: string;
}
export interface Citation {
  id: string;
  module_id?: string;
  revision_id?: string;
  page_id?: string;
  source_id?: string;
  title: string;
  kind: "wiki" | "source" | "article";
  release: string;
  locator: string;
  excerpt: string;
}
export type AnswerStatus =
  | "streaming"
  | "complete"
  | "partial"
  | "insufficient_evidence"
  | "failed"
  | "cancelled";
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: AnswerStatus;
  citations?: Citation[];
}
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}
export interface SearchResult {
  hits: Story[];
  answer?: string;
  citations?: Citation[];
  status: AnswerStatus;
  request_id: string;
  lanes?: { name: string; status: string; candidates?: number }[];
  gaps?: string[];
}
export interface ReleaseState {
  active_release_id: string;
  pointer_revision: number;
  candidate_release_id: string;
  build_id: string;
  build_state: "READY" | "BUILDING" | "FAILED";
  manifest_hash: string;
}
