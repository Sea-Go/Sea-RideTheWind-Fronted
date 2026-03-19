import { type NextRequest, NextResponse } from "next/server";

const USER_TOKEN_COOKIE_KEY = "user_center_token";
const ADMIN_TOKEN_COOKIE_KEY = "admin_center_token";
const USER_PROTECTED_PREFIXES = ["/profile", "/post"];

const isProtectedPath = (pathname: string): boolean =>
  USER_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE_KEY)?.value;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLoginRoute = pathname === "/admin/login";
  if (isAdminRoute) {
    if (isAdminLoginRoute) {
      if (adminToken) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.next();
    }

    if (adminToken) {
      return NextResponse.next();
    }

    const adminLoginUrl = new URL("/admin/login", request.url);
    adminLoginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(adminLoginUrl);
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(USER_TOKEN_COOKIE_KEY)?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/profile/:path*", "/post", "/post/:path*", "/admin/:path*"],
};
