import { getAdminAuthToken } from "@/services/admin";
import { USER_CENTER_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

const TOKEN_STORAGE_KEY = "user_center_token";
const TOKEN_COOKIE_KEY = "user_center_token";
const TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

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

export interface EnsureUserSessionPayload {
  username: string;
  password: string;
  email?: string;
}

export interface EnsureUserSessionResult {
  token: string;
  created: boolean;
}

export interface FrontendAccessState {
  userToken: string | null;
  adminToken: string | null;
  hasFrontendAccess: boolean;
  needsUserSession: boolean;
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
  password: string;
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

export const ensureUserSession = async (
  payload: EnsureUserSessionPayload,
): Promise<EnsureUserSessionResult> => {
  try {
    const { token } = await loginUser({
      username: payload.username,
      password: payload.password,
    });
    saveAuthToken(token);
    return { token, created: false };
  } catch (loginError) {
    try {
      await registerUser({
        username: payload.username,
        password: payload.password,
        email: payload.email,
      });
      const { token } = await loginUser({
        username: payload.username,
        password: payload.password,
      });
      saveAuthToken(token);
      return { token, created: true };
    } catch (registerError) {
      throw registerError instanceof Error ? registerError : loginError;
    }
  }
};

export const ADMIN_FRONTEND_SESSION_MESSAGE =
  "当前管理员会话还没有同步前台用户凭证，请重新登录一次管理员账号。";

export const normalizeUserUid = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
};

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
  document.cookie = `${TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${TOKEN_COOKIE_MAX_AGE}; SameSite=Lax`;
};

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const localToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (localToken) {
    return localToken;
  }

  const cookieToken = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${TOKEN_COOKIE_KEY}=`));
  if (!cookieToken) {
    return null;
  }

  const [, value = ""] = cookieToken.split("=");
  return decodeURIComponent(value) || null;
};

export const syncAuthCookieFromStorage = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const localToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!localToken) {
    return null;
  }

  document.cookie = `${TOKEN_COOKIE_KEY}=${encodeURIComponent(localToken)}; Path=/; Max-Age=${TOKEN_COOKIE_MAX_AGE}; SameSite=Lax`;
  return localToken;
};

export const getFrontendAccessState = (): FrontendAccessState => {
  const userToken = getAuthToken();
  const adminToken = getAdminAuthToken();

  return {
    userToken,
    adminToken,
    hasFrontendAccess: Boolean(userToken || adminToken),
    needsUserSession: Boolean(adminToken && !userToken),
  };
};

export const clearAuthToken = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  document.cookie = `${TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};
