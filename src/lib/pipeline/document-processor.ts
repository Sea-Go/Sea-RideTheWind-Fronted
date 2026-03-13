import type { ProcessedDocument } from "./types";

const cleanMarkdown = (content: string) =>
  content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const processDocument = (content: string): ProcessedDocument => {
  const normalizedText = cleanMarkdown(content);
  if (!normalizedText) {
    return {
      normalizedText: "",
      chunks: [],
    };
  }

  const chunkSize = 500;
  const chunks: string[] = [];
  for (let start = 0; start < normalizedText.length; start += chunkSize) {
    chunks.push(normalizedText.slice(start, start + chunkSize));
  }

  return {
    normalizedText,
    chunks,
  };
};
