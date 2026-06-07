"use client";

import {
  BookmarkIcon,
  FileTextIcon,
  HomeIcon,
  InfoIcon,
  LogInIcon,
  LogOutIcon,
  MapIcon,
  MenuIcon,
  MessageSquareIcon,
  PenBoxIcon,
  SettingsIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { markNavigationStart } from "@/components/motion/navigation-timing";
import {
  DEFAULT_PROFILE_THEME_ID,
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  profileThemeMap,
  resolveProfileThemeId,
  shouldApplyFrontendTheme,
} from "@/components/profile/profile-theme-config";
import { Button } from "@/components/ui/button";
import { buildLoginPath, USER_HOME_PATH } from "@/lib/auth-entry";
import { cn } from "@/lib/utils";
import {
  clearAdminAuthToken,
  getAdminAuthToken,
  syncAdminAuthCookieFromStorage,
} from "@/services/admin";
import { clearAuthToken, getAuthToken, syncAuthCookieFromStorage } from "@/services/auth";

const USER_TOKEN_STORAGE_KEY = "user_center_token";
const ADMIN_TOKEN_STORAGE_KEY = "admin_center_token";

const HeaderAboutDialog = dynamic(
  () => import("@/components/layout/HeaderAboutDialog").then((mod) => mod.HeaderAboutDialog),
  {
    ssr: false,
  },
);

const baseNavItems = [
  { href: USER_HOME_PATH, label: "首页", icon: HomeIcon },
  { href: "/dashboard/travel-agent", label: "旅行 Agent", icon: MapIcon },
  { href: "/post", label: "发布", icon: PenBoxIcon },
  { href: "/profile/articles", label: "文章管理", icon: FileTextIcon },
  { href: "/messages", label: "消息", icon: MessageSquareIcon },
  { href: "/profile/favorites", label: "我的收藏", icon: BookmarkIcon },
  { href: "/profile", label: "个人中心", icon: UserIcon },
];

const PRIMARY_PREFETCH_PATHS = [
  USER_HOME_PATH,
  "/dashboard/hot",
  "/dashboard/travel-agent",
  "/post",
  "/profile",
] as const;
const SECONDARY_PREFETCH_PATHS = ["/profile/articles", "/messages", "/profile/favorites"] as const;

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
  if (href === USER_HOME_PATH) {
    return (
      pathname === "/dashboard" ||
      (pathname.startsWith("/dashboard/") && pathname !== "/dashboard/travel-agent")
    );
  }

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

  useEffect(() => {
    PRIMARY_PREFETCH_PATHS.forEach((href) => {
      router.prefetch(href);
    });
  }, [router]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    SECONDARY_PREFETCH_PATHS.forEach((href) => {
      router.prefetch(href);
    });
  }, [isMobileMenuOpen, router]);

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
    markNavigationStart(nextLoginPath);
    router.push(nextLoginPath);
  };

  const renderBrand = (className?: string) => (
    <div className={cn("text-primary font-extrabold tracking-tight drop-shadow-sm", className)}>
      识海社区
    </div>
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
            "flex items-center gap-3 rounded-2xl transition-all duration-200",
            mode === "desktop" ? "px-4 py-3 text-sm" : "px-4 py-3.5 text-base",
            isActive
              ? "bg-primary text-primary-foreground shadow-primary/20 shadow-lg"
              : "text-muted-foreground hover:bg-accent/80 hover:text-primary hover:shadow-sm",
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
          "text-muted-foreground hover:text-primary hover:bg-accent/80 justify-start rounded-2xl hover:shadow-sm",
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
        className="border-border/75 bg-card/80 sticky top-0 z-50 border-b shadow-sm shadow-black/5 backdrop-blur-xl transition-[background-color,border-color,color] duration-300 lg:hidden"
        style={
          profileTheme
            ? {
                ...profileTheme.style,
                background: "var(--app-header-background)",
              }
            : undefined
        }
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
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            aria-label="关闭菜单蒙层"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div
            className="border-border/75 bg-card/95 absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col border-l shadow-2xl shadow-black/15 backdrop-blur-xl"
            style={
              profileTheme
                ? {
                    ...profileTheme.style,
                    background: "var(--app-menu-background)",
                  }
                : undefined
            }
          >
            <div className="border-border/70 flex items-center justify-between border-b px-4 py-4">
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
        className="border-border/80 bg-card/90 sticky top-0 hidden h-screen w-[16.75rem] shrink-0 flex-col overflow-hidden border-r py-6 shadow-xl shadow-black/10 backdrop-blur-xl transition-[background-color,border-color,color] duration-300 lg:flex"
        style={
          profileTheme
            ? {
                ...profileTheme.style,
                background: "var(--app-sidebar-background)",
              }
            : undefined
        }
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

        <nav className="relative z-10 mt-8 flex w-full flex-1 flex-col space-y-2 px-4 text-sm font-semibold">
          {renderNavLinks("desktop")}
          {renderMenuActions("desktop")}
        </nav>
      </aside>

      {isAboutOpen ? (
        <HeaderAboutDialog
          open={isAboutOpen}
          onOpenChange={setIsAboutOpen}
          themeStyle={profileTheme?.style}
        />
      ) : null}
    </>
  );
};
