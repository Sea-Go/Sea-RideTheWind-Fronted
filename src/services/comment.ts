import { COMMENT_API_PATHS } from "@/constants/api-paths";
import { withBearerAuthorization } from "@/services/request";

export type CommentId = number | string;

export const COMMENT_ACTION = {
  LIKE: 1,
  CANCEL_LIKE: 2,
  DISLIKE: 3,
  CANCEL_DISLIKE: 4,
} as const;

export type CommentActionType = (typeof COMMENT_ACTION)[keyof typeof COMMENT_ACTION];

export interface CreateCommentPayload {
  target_type: string;
  target_id: string;
  root_id?: CommentId;
  parent_id?: CommentId;
  content: string;
  meta?: string;
}

export interface CreateCommentResponse {
  id: CommentId;
  created_at: string;
  subject_count: number;
}

export interface GetCommentListPayload {
  target_type: string;
  target_id: string;
  sort_type?: number;
  root_id?: CommentId;
  page?: number;
  page_size?: number;
}

export interface CommentItem {
  id: CommentId;
  user_id: CommentId;
  username?: string;
  author_name?: string;
  avatar_url?: string;
  author_avatar_url?: string;
  content: string;
  root_id: CommentId;
  parent_id: CommentId;
  reply_to_user_id?: CommentId;
  reply_to_name?: string;
  like_count: number;
  dislike_count: number;
  reply_count: number;
  attribute: number;
  state: number;
  created_at: string;
  meta?: string;
  children?: CommentItem[];
}

export interface CommentSubject {
  target_type: string;
  target_id: string;
  total_count: number;
  root_count: number;
  state: number;
  attribute: number;
  owner_id: CommentId;
}

export interface GetCommentListResponse {
  comment: CommentItem[];
  subject: CommentSubject;
}

export interface LikeCommentPayload {
  target_type: string;
  target_id: string;
  comment_id: CommentId;
  action_type: CommentActionType;
}

export interface LikeCommentResponse {
  success: boolean;
  like_count: number;
}

const LARGE_INTEGER_FIELD_PATTERN =
  /"((?:id|user_id|root_id|parent_id|owner_id|comment_id))"\s*:\s*(-?\d{16,})/g;

const isWrappedPayload = (value: unknown): value is { code: number; msg: string; data: unknown } =>
  Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { code?: unknown }).code === "number" &&
    typeof (value as { msg?: unknown }).msg === "string" &&
    Object.hasOwn(value, "data"),
  );

const parseCommentResponsePayload = (rawText: string): unknown => {
  if (!rawText) {
    return null;
  }

  return JSON.parse(
    rawText.replace(
      LARGE_INTEGER_FIELD_PATTERN,
      (_match, field: string, value: string) => `"${field}":"${value}"`,
    ),
  ) as unknown;
};

const extractPayloadMessage = (payload: unknown): string | null => {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  for (const candidate of [record.msg, record.message, record.error]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

const normalizeRawInteger = (value: CommentId): string => {
  const rawValue = String(value).trim();
  if (!/^\d+$/.test(rawValue)) {
    throw new Error("评论参数格式异常");
  }
  return rawValue;
};

const stringifyWithRawIntegers = (
  payload: Record<string, unknown>,
  rawIntegerKeys: string[],
): string => {
  const serializablePayload = { ...payload };
  const replacements = new Map<string, string>();

  for (const key of rawIntegerKeys) {
    const rawValue = serializablePayload[key];
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    const marker = `__RAW_INTEGER_${key}__`;
    replacements.set(marker, normalizeRawInteger(rawValue as CommentId));
    serializablePayload[key] = marker;
  }

  let text = JSON.stringify(serializablePayload);
  for (const [marker, value] of replacements) {
    text = text.replace(`"${marker}"`, value);
  }
  return text;
};

const commentRequest = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: (() => {
      const headers = new Headers(init.headers);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return headers;
    })(),
  });

  const payload = parseCommentResponsePayload(await response.text());
  const wrappedPayload = isWrappedPayload(payload) ? payload : null;
  const payloadMessage = extractPayloadMessage(payload);

  if (!response.ok) {
    throw new Error(wrappedPayload?.msg ?? payloadMessage ?? "请求失败，请稍后重试");
  }

  if (wrappedPayload) {
    if (wrappedPayload.code !== 200) {
      throw new Error(wrappedPayload.msg || "请求失败，请稍后重试");
    }
    return wrappedPayload.data as T;
  }

  return payload as T;
};

export const createComment = (
  token: string,
  payload: CreateCommentPayload,
): Promise<CreateCommentResponse> =>
  commentRequest<CreateCommentResponse>(COMMENT_API_PATHS.create, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: stringifyWithRawIntegers(
      {
        ...payload,
        root_id: payload.root_id ?? 0,
        parent_id: payload.parent_id ?? 0,
        meta: payload.meta ?? "",
      },
      ["root_id", "parent_id"],
    ),
  });

export const getCommentList = (
  token: string,
  payload: GetCommentListPayload,
): Promise<GetCommentListResponse> =>
  commentRequest<GetCommentListResponse>(COMMENT_API_PATHS.list, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: stringifyWithRawIntegers(
      {
        ...payload,
        sort_type: payload.sort_type ?? 0,
        root_id: payload.root_id ?? 0,
        page: payload.page ?? 1,
        page_size: payload.page_size ?? 20,
      },
      ["root_id"],
    ),
  });

export const likeComment = (
  token: string,
  payload: LikeCommentPayload,
): Promise<LikeCommentResponse> =>
  commentRequest<LikeCommentResponse>(COMMENT_API_PATHS.like, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: stringifyWithRawIntegers(payload as unknown as Record<string, unknown>, ["comment_id"]),
  });

export const getRootComments = (
  token: string,
  payload: Omit<GetCommentListPayload, "root_id">,
): Promise<GetCommentListResponse> =>
  getCommentList(token, {
    ...payload,
    root_id: 0,
  });

export const getCommentReplies = (
  token: string,
  payload: Omit<GetCommentListPayload, "root_id"> & { root_id: CommentId },
): Promise<GetCommentListResponse> => getCommentList(token, payload);
