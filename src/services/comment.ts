import { COMMENT_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

export interface GetCommentListPayload {
  target_type: string;
  target_id: string;
  sort_type?: number;
  root_id?: number;
  page?: number;
  page_size?: number;
}

export interface CommentItem {
  id: number;
  user_id: number;
  content: string;
  root_id: number;
  parent_id: number;
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

export const getCommentList = (
  token: string,
  payload: GetCommentListPayload,
): Promise<GetCommentListResponse> =>
  request<GetCommentListResponse>(COMMENT_API_PATHS.list, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });
