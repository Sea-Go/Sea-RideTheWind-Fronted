import { LIKE_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

export const LIKE_STATE = {
  NONE: 0,
  LIKED: 1,
  DISLIKED: 3,
} as const;

export type LikeState = (typeof LIKE_STATE)[keyof typeof LIKE_STATE];

export const LIKE_ACTION = {
  LIKE: 1,
  CANCEL_LIKE: 2,
  DISLIKE: 3,
  CANCEL_DISLIKE: 4,
} as const;

export type LikeActionType = (typeof LIKE_ACTION)[keyof typeof LIKE_ACTION];
export type ReactionTarget = typeof LIKE_STATE.LIKED | typeof LIKE_STATE.DISLIKED;
export type ReactionStep = LikeActionType;

export const toLikeState = (value: unknown, fallback: LikeState = LIKE_STATE.NONE): LikeState =>
  value === LIKE_STATE.LIKED || value === LIKE_STATE.DISLIKED
    ? value
    : value === 0 || value === 2 || value === 4
      ? LIKE_STATE.NONE
      : fallback;

export const isLikedState = (state: number): state is typeof LIKE_STATE.LIKED =>
  state === LIKE_STATE.LIKED;

export const isDislikedState = (state: number): state is typeof LIKE_STATE.DISLIKED =>
  state === LIKE_STATE.DISLIKED;

export const buildReactionSteps = (
  currentState: LikeState,
  targetState: ReactionTarget,
): ReactionStep[] => {
  if (currentState === targetState) {
    return [
      targetState === LIKE_STATE.LIKED ? LIKE_ACTION.CANCEL_LIKE : LIKE_ACTION.CANCEL_DISLIKE,
    ];
  }

  if (currentState === LIKE_STATE.NONE) {
    return [targetState === LIKE_STATE.LIKED ? LIKE_ACTION.LIKE : LIKE_ACTION.DISLIKE];
  }

  if (targetState === LIKE_STATE.LIKED) {
    return [LIKE_ACTION.CANCEL_DISLIKE, LIKE_ACTION.LIKE];
  }

  return [LIKE_ACTION.CANCEL_LIKE, LIKE_ACTION.DISLIKE];
};

export const applyReactionStep = (state: LikeState, step: ReactionStep): LikeState => {
  if (step === LIKE_ACTION.CANCEL_LIKE || step === LIKE_ACTION.CANCEL_DISLIKE) {
    return LIKE_STATE.NONE;
  }
  if (step === LIKE_ACTION.LIKE) {
    return LIKE_STATE.LIKED;
  }
  if (step === LIKE_ACTION.DISLIKE) {
    return LIKE_STATE.DISLIKED;
  }
  return state;
};

export const resolveReactionFinalState = (
  currentState: LikeState,
  targetState: ReactionTarget,
): LikeState => {
  if (currentState === targetState) {
    return LIKE_STATE.NONE;
  }
  return targetState;
};

export interface LikeActionPayload {
  target_type: string;
  target_id: string;
  action_type: LikeActionType;
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
