import { ADMIN_CENTER_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

const ADMIN_TOKEN_STORAGE_KEY = "admin_center_token";
const ADMIN_TOKEN_COOKIE_KEY = "admin_center_token";
const ADMIN_TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export interface AdminExtraInfo {
  [key: string]: unknown;
}

export interface AdminProfile {
  id?: number;
  uid: string | number;
  username: string;
  email?: string;
  extra_info?: AdminExtraInfo;
}

export interface AdminUserProfile extends AdminProfile {
  status?: number;
}

export interface AdminCreatePayload {
  username: string;
  password: string;
  email?: string;
  invite_code: string;
  extra_info?: AdminExtraInfo;
}

export interface AdminCreateResponse {
  uid: string | number;
}

export interface AdminLoginPayload {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
}

export interface AdminGetUserParams {
  uid?: string;
}

export interface AdminGetUserResponse {
  user: AdminUserProfile;
  found: boolean;
}

export interface AdminGetSelfResponse {
  admin: AdminProfile;
}

export interface AdminGetUserListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
}

export type AdminGetUserListResponse = Record<string, unknown>;

export interface AdminDeleteUserPayload {
  uid: string;
}

export interface AdminUpdateSelfPayload {
  username?: string;
  password?: string;
  email?: string;
  extra_info?: AdminExtraInfo;
}

export interface AdminUpdateUserPayload {
  uid: string;
  username?: string;
  password?: string;
  email?: string;
  extra_info?: AdminExtraInfo;
}

export interface AdminUidPayload {
  uid: string;
}

export interface AdminActionResponse {
  success: boolean;
}

export type AdminLogoutResponse = AdminActionResponse;

const appendQueryParams = (
  path: string,
  params?: Record<string, string | number | undefined>,
): string => {
  if (!params) {
    return path;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
};

export const createAdmin = (payload: AdminCreatePayload): Promise<AdminCreateResponse> =>
  request<AdminCreateResponse>(ADMIN_CENTER_API_PATHS.create, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const loginAdmin = (payload: AdminLoginPayload): Promise<AdminLoginResponse> =>
  request<AdminLoginResponse>(ADMIN_CENTER_API_PATHS.login, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getAdminUser = (
  token: string,
  params?: AdminGetUserParams,
): Promise<AdminGetUserResponse> =>
  request<AdminGetUserResponse>(
    appendQueryParams(ADMIN_CENTER_API_PATHS.getUser, {
      uid: params?.uid,
    }),
    {
      method: "GET",
      headers: withBearerAuthorization(token),
    },
  );

export const getAdminSelf = (token: string): Promise<AdminGetSelfResponse> =>
  request<AdminGetSelfResponse>(ADMIN_CENTER_API_PATHS.getSelf, {
    method: "GET",
    headers: withBearerAuthorization(token),
  });

export const getAdminUserList = (
  token: string,
  params?: AdminGetUserListParams,
): Promise<AdminGetUserListResponse> =>
  request<AdminGetUserListResponse>(
    appendQueryParams(ADMIN_CENTER_API_PATHS.getUserList, {
      page: params?.page,
      page_size: params?.page_size,
      keyword: params?.keyword,
    }),
    {
      method: "GET",
      headers: withBearerAuthorization(token),
    },
  );

export const deleteAdminUser = (
  token: string,
  payload: AdminDeleteUserPayload,
): Promise<AdminActionResponse> =>
  request<AdminActionResponse>(ADMIN_CENTER_API_PATHS.deleteUser, {
    method: "DELETE",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const updateAdminSelf = (
  token: string,
  payload: AdminUpdateSelfPayload,
): Promise<AdminActionResponse> =>
  request<AdminActionResponse>(ADMIN_CENTER_API_PATHS.updateSelf, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const updateAdminUser = (
  token: string,
  payload: AdminUpdateUserPayload,
): Promise<AdminActionResponse> =>
  request<AdminActionResponse>(ADMIN_CENTER_API_PATHS.updateUser, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const resetAdminUserPassword = (
  token: string,
  payload: AdminUidPayload,
): Promise<AdminActionResponse> =>
  request<AdminActionResponse>(ADMIN_CENTER_API_PATHS.resetUserPassword, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const banAdminUser = (
  token: string,
  payload: AdminUidPayload,
): Promise<AdminActionResponse> =>
  request<AdminActionResponse>(ADMIN_CENTER_API_PATHS.banUser, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const unbanAdminUser = (
  token: string,
  payload: AdminUidPayload,
): Promise<AdminActionResponse> =>
  request<AdminActionResponse>(ADMIN_CENTER_API_PATHS.unbanUser, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const logoutAdmin = (token: string): Promise<AdminLogoutResponse> =>
  request<AdminLogoutResponse>(ADMIN_CENTER_API_PATHS.logout, {
    method: "POST",
    headers: withBearerAuthorization(token),
  });

export const saveAdminAuthToken = (token: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  document.cookie = `${ADMIN_TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${ADMIN_TOKEN_COOKIE_MAX_AGE}; SameSite=Lax`;
};

export const getAdminAuthToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const localToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  if (localToken) {
    return localToken;
  }

  const cookieToken = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ADMIN_TOKEN_COOKIE_KEY}=`));
  if (!cookieToken) {
    return null;
  }

  const [, value = ""] = cookieToken.split("=");
  return decodeURIComponent(value) || null;
};

export const clearAdminAuthToken = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  document.cookie = `${ADMIN_TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};
