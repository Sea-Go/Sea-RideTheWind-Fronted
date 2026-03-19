const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

export const extractUploadUrl = (payload: unknown): string | null => {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const topLevelUrl = record.image_url;
  if (typeof topLevelUrl === "string" && topLevelUrl.trim()) {
    return topLevelUrl.trim();
  }

  if (Object.hasOwn(record, "data")) {
    const nestedRecord = asRecord(record.data);
    const nestedUrl = nestedRecord?.image_url;
    if (typeof nestedUrl === "string" && nestedUrl.trim()) {
      return nestedUrl.trim();
    }
  }

  return null;
};

export const extractUploadError = (payload: unknown): string | null => {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const candidates = [record.msg, record.message, record.error];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};
