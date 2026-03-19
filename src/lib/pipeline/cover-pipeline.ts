import { generateImageBufferFromPrompt } from "./image-service";
import { buildCoverPromptFromSummary } from "./prompt-service";
import { uploadCoverImageToServer } from "./storage-service";
import { generateStructuredSummary } from "./summary-service";
import type { CoverPipelineResult, CoverUploadOptions } from "./types";

export const runCoverPipeline = async ({
  title,
  content,
  upload,
}: {
  title?: string;
  content: string;
  upload: CoverUploadOptions;
}): Promise<CoverPipelineResult> => {
  const summaryResult = await generateStructuredSummary({ title, content });
  const summary = summaryResult.summary;

  const promptResult = await buildCoverPromptFromSummary({
    summary,
    title,
    content,
  });
  const prompt = promptResult.prompt;
  const imageData = await generateImageBufferFromPrompt(prompt);
  const cover = await uploadCoverImageToServer({
    articleServerUrl: upload.articleServerUrl,
    authorization: upload.authorization,
    buffer: imageData.buffer,
    contentType: imageData.contentType,
  });

  return {
    summary,
    prompt,
    cover,
    summarySource: summaryResult.source,
    summaryGroundingScore: summaryResult.groundingScore,
    promptSource: promptResult.source,
    promptGroundingMatchedCount: promptResult.groundingMatchedCount,
  };
};
