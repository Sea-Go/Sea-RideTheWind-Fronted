export interface StructuredSummary {
  title: string;
  domain: string;
  coreProblem: string;
  keyContributions: string[];
  keywords: string[];
  tone: "academic" | "engineering" | "general";
}

export type GenerationSource = "llm" | "fallback";

export interface SummaryGenerationResult {
  summary: StructuredSummary;
  source: GenerationSource;
  groundingScore: number;
}

export interface PromptGenerationResult {
  prompt: string;
  source: GenerationSource;
  groundingMatchedCount: number;
}

export interface ProcessedDocument {
  normalizedText: string;
  chunks: string[];
}

export interface CoverPipelineResult {
  summary: StructuredSummary;
  summaryPath: string;
  prompt: string;
  cover: string;
  summarySource: GenerationSource;
  summaryGroundingScore: number;
  promptSource: GenerationSource;
  promptGroundingMatchedCount: number;
}
