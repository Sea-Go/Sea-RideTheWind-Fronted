import { runCoverPipeline } from "@/lib/pipeline/cover-pipeline";

export const generateCoverAssetFromContent = async ({
  title,
  content,
}: {
  title?: string;
  content: string;
}) => runCoverPipeline({ title, content });

export const generateAICoverFromContent = async ({
  title,
  content,
}: {
  title?: string;
  content: string;
}) => {
  const result = await generateCoverAssetFromContent({ title, content });
  return result.cover;
};
