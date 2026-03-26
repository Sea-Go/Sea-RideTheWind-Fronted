import { COMMENT_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

export type CommentId = number | string;

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
  user_id: number;
  content: string;
  root_id: CommentId;
  parent_id: CommentId;
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
  owner_id: number;
}

export interface GetCommentListResponse {
  comment: CommentItem[];
  subject: CommentSubject;
}

export const createComment = (
  token: string,
  payload: CreateCommentPayload,
): Promise<CreateCommentResponse> =>
  request<CreateCommentResponse>(COMMENT_API_PATHS.create, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify({
      ...payload,
      root_id: payload.root_id ?? 0,
      parent_id: payload.parent_id ?? 0,
      meta: payload.meta ?? "",
    }),
  });

export const getCommentList = (
  token: string,
  payload: GetCommentListPayload,
): Promise<GetCommentListResponse> =>
  request<GetCommentListResponse>(COMMENT_API_PATHS.list, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
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
