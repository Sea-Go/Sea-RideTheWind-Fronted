import { COVER_API_PATHS } from "@/constants/api-paths";

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

export const buildCoverPreviewSrc = (coverUrl: string | null | undefined): string | null => {
  if (typeof coverUrl !== "string") {
    return null;
  }

  const trimmed = coverUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:") || trimmed.startsWith("/")) {
    return trimmed;
  }

  if (!ABSOLUTE_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const searchParams = new URLSearchParams({ url: trimmed });
  return `${COVER_API_PATHS.preview}?${searchParams.toString()}`;
};
