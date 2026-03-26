export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

interface RequestOptions extends RequestInit {
  responseMode?: "auto" | "wrapped" | "raw";
}

const DEFAULT_ERROR_MESSAGE = "请求失败，请稍后重试";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const buildRequestUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("/api/")) {
    return path;
  }

  throw new Error("请求路径必须以 /api/ 开头，或使用绝对地址");
};

const buildHeaders = (headers?: HeadersInit): Headers => {
  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  return mergedHeaders;
};

const isWrappedPayload = <T>(value: unknown): value is ApiResponse<T> => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.code === "number" &&
    typeof payload.msg === "string" &&
    Object.hasOwn(payload, "data")
  );
};

const parseResponsePayload = async (response: Response): Promise<unknown> => {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch (error) {
    void error;
    return rawText;
  }
};

const extractPayloadMessage = (payload: unknown): string | null => {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

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

  const nestedError = asRecord(record.error);
  if (!nestedError) {
    return null;
  }

  const nestedCandidates = [nestedError.msg, nestedError.message, nestedError.error];
  for (const candidate of nestedCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const responseMode = init?.responseMode ?? "auto";
  const response = await fetch(buildRequestUrl(path), {
    ...init,
    headers: buildHeaders(init?.headers),
  });

  const payload = await parseResponsePayload(response);
  const wrappedPayload = isWrappedPayload<T>(payload) ? payload : null;
  const payloadMessage = extractPayloadMessage(payload);

  if (!response.ok) {
    throw new Error(wrappedPayload?.msg ?? payloadMessage ?? DEFAULT_ERROR_MESSAGE);
  }

  if (payload === null) {
    throw new Error(DEFAULT_ERROR_MESSAGE);
  }

  if (responseMode === "wrapped") {
    if (!wrappedPayload) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    if (wrappedPayload.code !== 200) {
      throw new Error(wrappedPayload.msg || DEFAULT_ERROR_MESSAGE);
    }

    return wrappedPayload.data;
  }

  if (responseMode === "raw") {
    return payload as T;
  }

  if (wrappedPayload) {
    if (wrappedPayload.code !== 200) {
      throw new Error(wrappedPayload.msg || DEFAULT_ERROR_MESSAGE);
    }

    return wrappedPayload.data;
  }

  return payload as T;
}

export const withBearerAuthorization = (token: string, headers?: HeadersInit): Headers => {
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set("Authorization", `Bearer ${token}`);
  return mergedHeaders;
};
