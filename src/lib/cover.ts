import { runCoverPipeline } from "@/lib/pipeline/cover-pipeline";
import type { CoverUploadOptions } from "@/lib/pipeline/types";

export const generateCoverAssetFromContent = async ({
  title,
  content,
  upload,
}: {
  title?: string;
  content: string;
  upload: CoverUploadOptions;
}) => runCoverPipeline({ title, content, upload });

export const generateAICoverFromContent = async ({
  title,
  content,
  upload,
}: {
  title?: string;
  content: string;
  upload: CoverUploadOptions;
}) => {
  const result = await generateCoverAssetFromContent({ title, content, upload });
  return result.cover;
};
