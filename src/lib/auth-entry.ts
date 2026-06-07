export type AuthRole = "user" | "admin";
export type AuthMode = "login" | "register";

export const DEFAULT_AUTH_ROLE: AuthRole = "user";
export const DEFAULT_AUTH_MODE: AuthMode = "login";
export const USER_HOME_PATH = "/dashboard/recommend";

export const normalizeAuthRole = (value?: string | null): AuthRole =>
  value === "admin" ? "admin" : DEFAULT_AUTH_ROLE;

export const normalizeAuthMode = (value?: string | null): AuthMode =>
  value === "register" ? "register" : DEFAULT_AUTH_MODE;

export const getSafeNextPath = (role: AuthRole, next?: string | null): string => {
  const fallback = role === "admin" ? "/admin" : USER_HOME_PATH;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  if (role === "user" && next.startsWith("/admin")) {
    return fallback;
  }
  if (role === "user" && next === "/dashboard") {
    return USER_HOME_PATH;
  }
  return next;
};

export const buildLoginPath = ({
  role = DEFAULT_AUTH_ROLE,
  mode = DEFAULT_AUTH_MODE,
  next,
}: {
  role?: AuthRole;
  mode?: AuthMode;
  next?: string | null;
} = {}): string => {
  const params = new URLSearchParams();

  if (role !== DEFAULT_AUTH_ROLE) {
    params.set("role", role);
  }
  if (mode !== DEFAULT_AUTH_MODE) {
    params.set("mode", mode);
  }
  if (next) {
    params.set("next", next);
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
};

export const buildOnboardingQuestionnairePath = (next?: string | null): string => {
  const params = new URLSearchParams();
  const safeNext = getSafeNextPath("user", next);

  if (safeNext && safeNext !== USER_HOME_PATH) {
    params.set("next", safeNext);
  } else {
    params.set("next", USER_HOME_PATH);
  }

  const query = params.toString();
  return query ? `/onboarding/questionnaire?${query}` : "/onboarding/questionnaire";
};
