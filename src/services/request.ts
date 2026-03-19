export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

interface RequestOptions extends RequestInit {
  responseMode?: "auto" | "wrapped" | "raw";
}

const DEFAULT_ERROR_MESSAGE = "请求失败，请稍后重试";

const buildRequestUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("/api/")) {
    return path;
  }

  throw new Error("request path must start with /api/ or use an absolute URL");
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

export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const responseMode = init?.responseMode ?? "auto";
  const response = await fetch(buildRequestUrl(path), {
    ...init,
    headers: buildHeaders(init?.headers),
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch (error) {
    // ignore parse errors and fallback to status-based error message below
    void error;
  }

  const wrappedPayload = isWrappedPayload<T>(payload) ? payload : null;

  if (!response.ok) {
    throw new Error(wrappedPayload?.msg ?? DEFAULT_ERROR_MESSAGE);
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
