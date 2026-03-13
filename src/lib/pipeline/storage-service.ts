import { promises as fs } from "fs";
import path from "path";

import type { StructuredSummary } from "./types";

const detectExtension = (contentType: string) => {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("jpeg")) {
    return "jpg";
  }
  if (normalized.includes("png")) {
    return "png";
  }
  return "png";
};

export const storeSummaryLocally = async (summary: StructuredSummary) => {
  const summaryDir = path.join(process.cwd(), "public", "summaries");
  await fs.mkdir(summaryDir, { recursive: true });

  const now = Date.now();
  const fileName = `summary-${now}.json`;
  const filePath = path.join(summaryDir, fileName);

  await fs.writeFile(filePath, JSON.stringify(summary, null, 2), "utf-8");
  return `/summaries/${fileName}`;
};

export const storeCoverImageLocally = async ({
  buffer,
  contentType,
}: {
  buffer: Buffer;
  contentType: string;
}) => {
  const extension = detectExtension(contentType);
  const coverDir = path.join(process.cwd(), "public", "covers");
  await fs.mkdir(coverDir, { recursive: true });

  const fileName = `cover-ai-${Date.now()}.${extension}`;
  const filePath = path.join(coverDir, fileName);
  await fs.writeFile(filePath, buffer);

  return `/covers/${fileName}`;
};
