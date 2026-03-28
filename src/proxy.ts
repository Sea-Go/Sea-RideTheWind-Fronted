import { type NextRequest, NextResponse } from "next/server";

const USER_TOKEN_COOKIE_KEY = "user_center_token";
const ADMIN_TOKEN_COOKIE_KEY = "admin_center_token";
const USER_LOGIN_ROUTE = "/login";
const USER_HOME_ROUTE = "/dashboard";
const ADMIN_HOME_ROUTE = "/admin";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const userToken = request.cookies.get(USER_TOKEN_COOKIE_KEY)?.value;
  const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE_KEY)?.value;

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLoginRoute = pathname === "/admin/login";
  const isAdminRegisterRoute = pathname === "/admin/register";

  if (isAdminRoute) {
    if (isAdminLoginRoute || isAdminRegisterRoute) {
      if (adminToken) {
        return NextResponse.redirect(new URL(ADMIN_HOME_ROUTE, request.url));
      }
      return NextResponse.next();
    }

    if (adminToken) {
      return NextResponse.next();
    }

    const adminLoginUrl = new URL(USER_LOGIN_ROUTE, request.url);
    adminLoginUrl.searchParams.set("role", "admin");
    adminLoginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(adminLoginUrl);
  }

  if (pathname === USER_LOGIN_ROUTE) {
    if (userToken) {
      return NextResponse.redirect(new URL(USER_HOME_ROUTE, request.url));
    }
    return NextResponse.next();
  }

  if (userToken || adminToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL(USER_LOGIN_ROUTE, request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
