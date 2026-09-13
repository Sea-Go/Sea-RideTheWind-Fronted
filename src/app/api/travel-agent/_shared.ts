import { createHash } from "crypto";
import type { NextRequest } from "next/server";

import { USER_CENTER_API_PATHS } from "@/constants/api-paths";

const USER_TOKEN_COOKIE_KEY = "user_center_token";
const ADMIN_TOKEN_COOKIE_KEY = "admin_center_token";
const USER_LOOKUP_TIMEOUT_MS = 800;

export const getTravelAgentServerUrl = (): string => {
  const value = process.env.TRAVEL_AGENT_SERVER_URL?.trim();
  if (!value) {
    throw new Error("缺少必要环境变量：TRAVEL_AGENT_SERVER_URL");
  }
  return value.replace(/\/+$/, "");
};

export const resolveTravelAgentUserId = async (request: NextRequest): Promise<string> => {
  const userToken = request.cookies.get(USER_TOKEN_COOKIE_KEY)?.value?.trim();
  if (userToken) {
    const uid = await resolveUserUid(request, userToken);
    if (uid) {
      return uid;
    }
    return `guest:${hashToken(userToken)}`;
  }

  const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE_KEY)?.value?.trim();
  if (adminToken) {
    return `admin:${hashToken(adminToken)}`;
  }

  return "guest:anonymous";
};

export const appendUserId = (url: URL, userId: string): URL => {
  url.searchParams.set("userId", userId);
  return url;
};

const resolveUserUid = async (request: NextRequest, token: string): Promise<string | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, USER_LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(
      new URL(USER_CENTER_API_PATHS.getUser, getInternalOrigin(request)),
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as unknown;
    return extractUid(payload);
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) {
      console.warn("Travel agent fallback to token scoped history:", error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getInternalOrigin = (request: NextRequest): string => {
  const configured = process.env.NEXT_SERVER_INTERNAL_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return `http://127.0.0.1:${process.env.PORT?.trim() || "3000"}`;
  }

  return request.nextUrl.origin;
};

const extractUid = (payload: unknown): string | null => {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }
  const candidates = [
    asRecord(record.user)?.uid,
    asRecord(asRecord(record.data)?.user)?.uid,
    asRecord(record.data)?.uid,
    record.uid,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex").slice(0, 20);
