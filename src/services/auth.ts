import { USER_CENTER_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

const TOKEN_STORAGE_KEY = "user_center_token";

export interface RegisterUserPayload {
  username: string;
  password: string;
  email?: string;
  extra_info?: Record<string, string>;
}

export interface RegisterUserResponse {
  uid: string;
}

export interface LoginUserPayload {
  username: string;
  password: string;
}

export interface LoginUserResponse {
  token: string;
}

export interface UserProfile {
  uid: string;
  score: number;
  username: string;
  email?: string;
  extra_info?: Record<string, string>;
}

export interface GetUserResponse {
  user: UserProfile;
  found: boolean;
}

export interface LogoutResponse {
  success: boolean;
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  email?: string;
  extra_info?: Record<string, string>;
}

export interface UpdateUserResponse {
  user: UserProfile;
}

export interface DeleteUserResponse {
  success: boolean;
}

export const registerUser = (payload: RegisterUserPayload): Promise<RegisterUserResponse> =>
  request<RegisterUserResponse>(USER_CENTER_API_PATHS.register, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const loginUser = (payload: LoginUserPayload): Promise<LoginUserResponse> =>
  request<LoginUserResponse>(USER_CENTER_API_PATHS.login, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getUserProfile = (token: string): Promise<GetUserResponse> =>
  request<GetUserResponse>(USER_CENTER_API_PATHS.getUser, {
    method: "GET",
    headers: withBearerAuthorization(token),
  });

export const updateUserProfile = (
  token: string,
  payload: UpdateUserPayload,
): Promise<UpdateUserResponse> =>
  request<UpdateUserResponse>(USER_CENTER_API_PATHS.updateUser, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const logoutUser = (token: string): Promise<LogoutResponse> =>
  request<LogoutResponse>(USER_CENTER_API_PATHS.logout, {
    method: "POST",
    headers: withBearerAuthorization(token),
  });

export const deleteCurrentUser = (token: string): Promise<DeleteUserResponse> =>
  request<DeleteUserResponse>(USER_CENTER_API_PATHS.deleteUser, {
    method: "DELETE",
    headers: withBearerAuthorization(token),
  });

export const saveAuthToken = (token: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const clearAuthToken = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};
