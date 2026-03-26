"use client";

import {
  BookmarkIcon,
  FileTextIcon,
  FlameIcon,
  HomeIcon,
  InfoIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PenBoxIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  DEFAULT_PROFILE_THEME_ID,
  PROFILE_THEME_EVENT_NAME,
  PROFILE_THEME_STORAGE_KEY,
  profileThemeMap,
  resolveProfileThemeId,
  shouldApplyFrontendTheme,
} from "@/components/profile/profile-theme-config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { clearAuthToken, getAuthToken } from "@/services/auth";

const navItems = [
  { href: "/dashboard", label: "首页", icon: HomeIcon },
  { href: "/hot", label: "热榜", icon: FlameIcon },
  { href: "/post", label: "发布", icon: PenBoxIcon },
  { href: "/profile/articles", label: "文章管理", icon: FileTextIcon },
  { href: "/messages", label: "消息", icon: MessageSquareIcon },
  { href: "/profile/favorites", label: "我的收藏", icon: BookmarkIcon },
  { href: "/profile", label: "个人中心", icon: UserIcon },
];

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

const subscribeAuthState = () => () => {};
const getClientAuthState = () => Boolean(getAuthToken());
const getServerAuthState = () => false;

export const Header = () => {
  const pathname = usePathname();
  const router = useRouter();
  const shouldApplyTheme = shouldApplyFrontendTheme(pathname);
  const isLoggedIn = useSyncExternalStore(
    subscribeAuthState,
    getClientAuthState,
    getServerAuthState,
  );
  const [profileThemeId, setProfileThemeId] = useState(DEFAULT_PROFILE_THEME_ID);

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

  const profileTheme = shouldApplyTheme ? profileThemeMap[profileThemeId] : null;

  const handleLogout = () => {
    clearAuthToken();
    router.push("/login");
  };

  return (
    <header
      className="border-border bg-background sticky top-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r py-6 shadow-sm transition-[background-color,border-color,color] duration-300"
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

      <div className="text-primary relative z-10 mb-10 px-8 text-xl font-bold tracking-tight">
        识海社区
      </div>

      <nav className="relative z-10 flex w-full flex-1 flex-col space-y-2 px-4 text-sm font-medium">
        {navItems.map((item) => {
          const isActive = matchRoute(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        {!isLoggedIn ? (
          <div className="pt-4">
            <Button asChild className="w-full rounded-full">
              <Link href="/login">登录</Link>
            </Button>
          </div>
        ) : null}
      </nav>

      <div className="relative z-10 mt-auto px-4 pb-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-accent hover:text-foreground h-auto w-full justify-start gap-3 rounded-lg px-4 py-3 text-sm font-medium"
            >
              <MenuIcon className="h-5 w-5" />
              更多
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="mb-2 w-56">
            <DropdownMenuItem className="cursor-pointer gap-2">
              <SettingsIcon className="h-4 w-4" />
              设置
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2">
              <InfoIcon className="h-4 w-4" />
              关于
            </DropdownMenuItem>
            {isLoggedIn ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer gap-2"
                >
                  <LogOutIcon className="h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
