import type { NextRequest } from "next/server";

const USER_TOKEN_COOKIE_KEY = "user_center_token";

export const ARTICLE_UPLOAD_UPSTREAM_PATH = "/v1/upload";

export const resolveAuthorizationHeader = (request: NextRequest): string | null => {
  const headerValue = request.headers.get("authorization")?.trim();
  if (headerValue) {
    return headerValue;
  }

  const cookieToken = request.cookies.get(USER_TOKEN_COOKIE_KEY)?.value?.trim();
  if (!cookieToken) {
    return null;
  }

  return `Bearer ${cookieToken}`;
};

export const getRequiredArticleServerUrl = (): string => {
  const value = process.env.ARTICLE_API_SERVER_URL?.trim();
  if (!value) {
    throw new Error("缺少必要环境变量：ARTICLE_API_SERVER_URL");
  }

  return value.replace(/\/+$/, "");
};
