export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildRequestUrl(path), {
    ...init,
    headers: buildHeaders(init?.headers),
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch (error) {
    // ignore parse errors and fallback to status-based error message below
    void error;
  }

  if (!response.ok) {
    throw new Error(payload?.msg ?? DEFAULT_ERROR_MESSAGE);
  }

  if (!payload) {
    throw new Error(DEFAULT_ERROR_MESSAGE);
  }

  if (payload.code !== 200) {
    throw new Error(payload.msg || DEFAULT_ERROR_MESSAGE);
  }

  return payload.data;
}

export const withBearerAuthorization = (token: string, headers?: HeadersInit): Headers => {
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set("Authorization", `Bearer ${token}`);
  return mergedHeaders;
};
