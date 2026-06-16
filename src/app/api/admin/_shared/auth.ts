import { NextRequest, NextResponse } from "next/server";

export const ADMIN_TOKEN_COOKIE_KEY = "admin_center_token";

export const trimServerUrl = (value?: string): string => (value ?? "").trim().replace(/\/+$/, "");

export const getBearerToken = (request: NextRequest): string => {
  const cookieToken = request.cookies.get(ADMIN_TOKEN_COOKIE_KEY)?.value?.trim();
  if (cookieToken) {
    return cookieToken;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
};

export const getAdminCenterUrl = (): string =>
  trimServerUrl(process.env.ADMIN_CENTER_API_SERVER_URL);

export const validateAdminToken = async (
  token: string,
  options: { skipEnvVar?: string } = {},
): Promise<boolean> => {
  const skipEnvVar = options.skipEnvVar ?? "ADMIN_PROXY_SKIP_ADMIN_AUTH";
  if (skipEnvVar && process.env[skipEnvVar] === "true") {
    return true;
  }

  if (!token) {
    return false;
  }

  const adminCenterUrl = getAdminCenterUrl();
  if (!adminCenterUrl) {
    return false;
  }

  try {
    const response = await fetch(`${adminCenterUrl}/admincenter/v1/admin/getself`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return false;
    }

    const payload = (await response.json().catch(() => null)) as {
      code?: number;
      data?: unknown;
    } | null;
    return payload?.code === undefined || payload.code === 200;
  } catch {
    return false;
  }
};

export const unauthorizedAdminResponse = (): NextResponse =>
  NextResponse.json({ code: 401, msg: "管理员身份验证失败", data: null }, { status: 401 });
