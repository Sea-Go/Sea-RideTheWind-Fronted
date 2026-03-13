import { LIKE_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

export interface LikeActionPayload {
  target_type: string;
  target_id: string;
  action_type: number;
  author_id?: string;
  weight?: number;
}

export interface LikerListPayload {
  target_type: string;
  target_id: string;
  cursor?: number;
  page_size?: number;
}

export interface UserLikeListPayload {
  target_type: string;
  cursor?: number;
  page_size?: number;
}

export interface TargetIdsPayload {
  target_type: string;
  target_ids: string[];
}

export interface LikeActionResult {
  success: boolean;
  message?: string;
  like_count: number;
  dislike_count: number;
}

export interface LikerItem {
  user_id: number;
  timestamp: number;
}

export interface LikerListResult {
  list: LikerItem[];
  is_end: boolean;
  next_cursor: number;
}

export interface UserLikeItem {
  target_type: string;
  target_id: string;
  timestamp: number;
}

export interface UserLikeListResult {
  list: UserLikeItem[];
  is_end: boolean;
  next_cursor: number;
}

export interface LikeCountResult {
  counts: Record<
    string,
    {
      like_count: number;
      dislike_count: number;
    }
  >;
}

export interface LikeStateResult {
  states: Record<string, number>;
}

export interface UserTotalLikeResult {
  total_like_count: number;
}

export const likeAction = (token: string, payload: LikeActionPayload): Promise<LikeActionResult> =>
  request<LikeActionResult>(LIKE_API_PATHS.likeAction, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const getTargetLikerList = (
  token: string,
  payload: LikerListPayload,
): Promise<LikerListResult> =>
  request<LikerListResult>(LIKE_API_PATHS.getTargetLikerList, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const getUserTotalLike = (token: string): Promise<UserTotalLikeResult> =>
  request<UserTotalLikeResult>(LIKE_API_PATHS.getUserTotalLike, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify({}),
  });

export const getUserLikeList = (
  token: string,
  payload: UserLikeListPayload,
): Promise<UserLikeListResult> =>
  request<UserLikeListResult>(LIKE_API_PATHS.getUserLikeList, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const getLikeCount = (token: string, payload: TargetIdsPayload): Promise<LikeCountResult> =>
  request<LikeCountResult>(LIKE_API_PATHS.getLikeCount, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const getLikeState = (token: string, payload: TargetIdsPayload): Promise<LikeStateResult> =>
  request<LikeStateResult>(LIKE_API_PATHS.getLikeState, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });
