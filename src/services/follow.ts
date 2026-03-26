import { FOLLOW_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

export interface RelationActionPayload {
  target_id: string;
}

export interface FollowListPayload {
  user_id?: string;
  offset?: number;
  limit?: number;
}

export interface RelationActionResult {
  success: boolean;
}

export interface FollowUserListResult {
  user_ids: number[];
}

export interface RecommendUser {
  target_id: number;
  mutual_score: number;
}

export interface RecommendListResult {
  users: RecommendUser[];
}

const postWithToken = <T>(token: string, path: string, payload: unknown): Promise<T> =>
  request<T>(path, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const followUser = (
  token: string,
  payload: RelationActionPayload,
): Promise<RelationActionResult> =>
  postWithToken<RelationActionResult>(token, FOLLOW_API_PATHS.follow, payload);

export const unfollowUser = (
  token: string,
  payload: RelationActionPayload,
): Promise<RelationActionResult> =>
  postWithToken<RelationActionResult>(token, FOLLOW_API_PATHS.unfollow, payload);

export const blockUser = (
  token: string,
  payload: RelationActionPayload,
): Promise<RelationActionResult> =>
  postWithToken<RelationActionResult>(token, FOLLOW_API_PATHS.block, payload);

export const unblockUser = (
  token: string,
  payload: RelationActionPayload,
): Promise<RelationActionResult> =>
  postWithToken<RelationActionResult>(token, FOLLOW_API_PATHS.unblock, payload);

export const getFollowList = (
  token: string,
  payload: FollowListPayload,
): Promise<FollowUserListResult> =>
  postWithToken<FollowUserListResult>(token, FOLLOW_API_PATHS.getFollowList, payload);

export const getFollowerList = (
  token: string,
  payload: FollowListPayload,
): Promise<FollowUserListResult> =>
  postWithToken<FollowUserListResult>(token, FOLLOW_API_PATHS.getFollowerList, payload);

export const getBlockList = (
  token: string,
  payload: FollowListPayload = {},
): Promise<FollowUserListResult> =>
  postWithToken<FollowUserListResult>(token, FOLLOW_API_PATHS.getBlockList, payload);

export const getRecommendations = (
  token: string,
  payload: FollowListPayload = {},
): Promise<RecommendListResult> =>
  postWithToken<RecommendListResult>(token, FOLLOW_API_PATHS.getRecommendations, payload);
