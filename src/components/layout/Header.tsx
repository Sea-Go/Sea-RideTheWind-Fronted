"use client";

import {
  BookmarkIcon,
  FileTextIcon,
  FlameIcon,
  HomeIcon,
  InfoIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PenBoxIcon,
  Settings2Icon,
  SettingsIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_PROFILE_THEME_ID,
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  profileThemeMap,
  resolveProfileThemeId,
  shouldApplyFrontendTheme,
} from "@/components/profile/profile-theme-config";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { buildLoginPath } from "@/lib/auth-entry";
import { cn } from "@/lib/utils";
import {
  clearAdminAuthToken,
  getAdminAuthToken,
  syncAdminAuthCookieFromStorage,
} from "@/services/admin";
import { clearAuthToken, getAuthToken, syncAuthCookieFromStorage } from "@/services/auth";

const USER_TOKEN_STORAGE_KEY = "user_center_token";
const ADMIN_TOKEN_STORAGE_KEY = "admin_center_token";

const baseNavItems = [
  { href: "/dashboard", label: "首页", icon: HomeIcon },
  { href: "/hot", label: "热榜", icon: FlameIcon },
  { href: "/post", label: "发布", icon: PenBoxIcon },
  { href: "/profile/articles", label: "文章管理", icon: FileTextIcon },
  { href: "/messages", label: "消息", icon: MessageSquareIcon },
  { href: "/profile/favorites", label: "我的收藏", icon: BookmarkIcon },
  { href: "/profile", label: "个人中心", icon: UserIcon },
];

const aboutContentLines = [
  "欢迎加入识海社区！",
  "qq群：750807478",
  "开源推荐系统：https://github.com/Sea-Go/Sea-BreakTheWaves",
  "开源后端：https://github.com/Sea-Go/Sea-BreakTheWaves",
  "开源前端：https://github.com/Sea-Go/Sea-RideTheWind-Fronted",
];

interface HeaderAuthState {
  hasAdminSession: boolean;
  hasUserSession: boolean;
  isLoggedIn: boolean;
}

const EMPTY_AUTH_STATE: HeaderAuthState = {
  hasAdminSession: false,
  hasUserSession: false,
  isLoggedIn: false,
};

const matchRoute = (pathname: string, href: string) => {
  if (href === "/profile") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        !pathname.startsWith("/profile/favorites") &&
        !pathname.startsWith("/profile/articles"))
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export const Header = () => {
  const pathname = usePathname();
  const router = useRouter();
  const shouldApplyTheme = shouldApplyFrontendTheme(pathname);
  const [authState, setAuthState] = useState<HeaderAuthState>(EMPTY_AUTH_STATE);
  const [profileThemeId, setProfileThemeId] = useState(DEFAULT_PROFILE_THEME_ID);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = useMemo(
    () =>
      authState.hasAdminSession
        ? [...baseNavItems, { href: "/admin", label: "管理员中心", icon: SettingsIcon }]
        : baseNavItems,
    [authState.hasAdminSession],
  );

  useEffect(() => {
    const syncSessionState = () => {
      const userToken = syncAuthCookieFromStorage() ?? getAuthToken();
      const adminToken = syncAdminAuthCookieFromStorage() ?? getAdminAuthToken();

      setAuthState({
        hasAdminSession: Boolean(adminToken),
        hasUserSession: Boolean(userToken),
        isLoggedIn: Boolean(userToken || adminToken),
      });
    };

    syncSessionState();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === USER_TOKEN_STORAGE_KEY ||
        event.key === ADMIN_TOKEN_STORAGE_KEY
      ) {
        syncSessionState();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !shouldApplyTheme) {
      return;
    }

    const syncTheme = (value?: string | null) => {
      setProfileThemeId(
        resolveProfileThemeId(value ?? window.localStorage.getItem(PROFILE_THEME_STORAGE_KEY)),
      );
    };

    syncTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PROFILE_THEME_STORAGE_KEY) {
        return;
      }

      syncTheme(event.newValue);
    };

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ themeId?: string }>;
      syncTheme(customEvent.detail?.themeId);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PROFILE_THEME_EVENT_NAME, handleThemeChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PROFILE_THEME_EVENT_NAME, handleThemeChange as EventListener);
    };
  }, [shouldApplyTheme]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const profileTheme = shouldApplyTheme ? profileThemeMap[profileThemeId] : null;

  const handleLogout = () => {
    const nextLoginPath =
      authState.hasAdminSession && !authState.hasUserSession
        ? buildLoginPath({ role: "admin" })
        : "/login";

    clearAuthToken();
    clearAdminAuthToken();
    setAuthState(EMPTY_AUTH_STATE);
    setIsMobileMenuOpen(false);
    router.push(nextLoginPath);
  };

  const renderBrand = (className?: string) => (
    <div className={cn("text-primary font-bold tracking-tight", className)}>识海社区</div>
  );

  const renderNavLinks = (mode: "desktop" | "mobile") =>
    navItems.map((item) => {
      const isActive = matchRoute(pathname, item.href);
      const Icon = item.icon;

      return (
        <Link
          key={`${mode}-${item.href}`}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-2xl transition-colors",
            mode === "desktop" ? "px-4 py-3 text-sm" : "px-4 py-3.5 text-base",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          onClick={mode === "mobile" ? () => setIsMobileMenuOpen(false) : undefined}
        >
          <Icon className={mode === "desktop" ? "h-5 w-5" : "h-5 w-5 shrink-0"} />
          <span>{item.label}</span>
        </Link>
      );
    });

  const renderMenuActions = (mode: "desktop" | "mobile") => (
    <div className={cn("space-y-2", mode === "desktop" ? "" : "mt-6")}>
      <Button
        variant="ghost"
        className={cn(
          "text-muted-foreground hover:bg-accent hover:text-foreground justify-start rounded-2xl",
          mode === "desktop" ? "h-auto w-full px-4 py-3 text-sm" : "h-12 w-full px-4 text-base",
        )}
      >
        <Settings2Icon className="h-5 w-5" />
        设置
      </Button>
      <Button
        variant="ghost"
        className={cn(
          "text-muted-foreground hover:bg-accent hover:text-foreground justify-start rounded-2xl",
          mode === "desktop" ? "h-auto w-full px-4 py-3 text-sm" : "h-12 w-full px-4 text-base",
        )}
        onClick={() => {
          setIsMobileMenuOpen(false);
          setIsAboutOpen(true);
        }}
      >
        <InfoIcon className="h-5 w-5" />
        关于
      </Button>
      {authState.isLoggedIn ? (
        <Button
          variant="ghost"
          className={cn(
            "text-destructive hover:bg-destructive/10 hover:text-destructive justify-start rounded-2xl",
            mode === "desktop" ? "h-auto w-full px-4 py-3 text-sm" : "h-12 w-full px-4 text-base",
          )}
          onClick={handleLogout}
        >
          <LogOutIcon className="h-5 w-5" />
          退出登录
        </Button>
      ) : (
        <Button
          asChild
          className={cn(
            "rounded-full",
            mode === "desktop" ? "mt-4 w-full" : "mt-4 h-12 w-full text-base",
          )}
        >
          <Link href="/login">
            <LogInIcon className="h-5 w-5" />
            登录
          </Link>
        </Button>
      )}
    </div>
  );

  return (
    <>
      <header
        className="border-border bg-background sticky top-0 z-50 border-b shadow-sm transition-[background-color,border-color,color] duration-300 lg:hidden"
        style={profileTheme?.style}
      >
        <div className="relative overflow-hidden">
          {profileTheme ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90"
                style={{ backgroundImage: profileTheme.heroGradient }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -top-4 right-0 h-20 w-20 rounded-full blur-2xl"
                style={{ backgroundColor: profileTheme.haloColor }}
              />
            </>
          ) : null}

          <div className="relative flex items-center justify-between px-4 py-3 sm:px-5">
            {renderBrand("text-lg")}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label={isMobileMenuOpen ? "关闭菜单" : "打开菜单"}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              {isMobileMenuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden" aria-modal="true" role="dialog">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            aria-label="关闭菜单蒙层"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div
            className="bg-background border-border absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col border-l shadow-2xl"
            style={profileTheme?.style}
          >
            <div className="border-border flex items-center justify-between border-b px-4 py-4">
              {renderBrand("text-xl")}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="关闭菜单"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <XIcon className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <nav className="space-y-2">{renderNavLinks("mobile")}</nav>
              {renderMenuActions("mobile")}
            </div>
          </div>
        </div>
      ) : null}

      <aside
        className="border-border bg-background sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-hidden border-r py-6 shadow-sm transition-[background-color,border-color,color] duration-300 lg:flex"
        style={profileTheme?.style}
      >
        {profileTheme ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-90"
              style={{ backgroundImage: profileTheme.heroGradient }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute top-12 -right-8 h-28 w-28 rounded-full blur-3xl"
              style={{ backgroundColor: profileTheme.haloColor }}
            />
          </>
        ) : null}

        <div className="relative z-10 px-8">{renderBrand("text-xl")}</div>

        <nav className="relative z-10 mt-8 flex w-full flex-1 flex-col space-y-2 px-4 text-sm font-medium">
          {renderNavLinks("desktop")}
          {renderMenuActions("desktop")}
        </nav>
      </aside>

      <AlertDialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
        <AlertDialogContent className="max-w-xl rounded-3xl border-sky-100 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(239,246,255,0.96))] p-0 shadow-2xl shadow-sky-100/70">
          <div className="relative overflow-hidden rounded-3xl p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.25),transparent_55%)]"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 rounded-full"
              onClick={() => setIsAboutOpen(false)}
              aria-label="关闭关于弹窗"
            >
              <XIcon className="size-4" />
            </Button>

            <div className="relative space-y-4 pr-10">
              <div className="space-y-2">
                <AlertDialogTitle className="text-2xl font-semibold tracking-tight text-slate-900">
                  关于识海社区
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-7 whitespace-pre-line text-slate-600">
                  {aboutContentLines.join("\n")}
                </AlertDialogDescription>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3 text-xs leading-6 text-slate-500">
                点击右上角的 × 就可以立刻关闭这个窗口。
              </div>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
