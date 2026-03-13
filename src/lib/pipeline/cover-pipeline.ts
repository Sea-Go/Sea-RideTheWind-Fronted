import { generateImageBufferFromPrompt } from "./image-service";
import { buildCoverPromptFromSummary } from "./prompt-service";
import { storeCoverImageLocally, storeSummaryLocally } from "./storage-service";
import { generateStructuredSummary } from "./summary-service";
import type { CoverPipelineResult } from "./types";

export const runCoverPipeline = async ({
  title,
  content,
}: {
  title?: string;
  content: string;
}): Promise<CoverPipelineResult> => {
  const summaryResult = await generateStructuredSummary({ title, content });
  const summary = summaryResult.summary;
  const summaryPath = await storeSummaryLocally(summary);

  const promptResult = await buildCoverPromptFromSummary({
    summary,
    title,
    content,
  });
  const prompt = promptResult.prompt;
  const imageData = await generateImageBufferFromPrompt(prompt);
  const cover = await storeCoverImageLocally({
    buffer: imageData.buffer,
    contentType: imageData.contentType,
  });

  return {
    summary,
    summaryPath,
    prompt,
    cover,
    summarySource: summaryResult.source,
    summaryGroundingScore: summaryResult.groundingScore,
    promptSource: promptResult.source,
    promptGroundingMatchedCount: promptResult.groundingMatchedCount,
  };
};
