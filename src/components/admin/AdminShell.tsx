"use client";

import {
  ActivityIcon,
  BellIcon,
  ChevronDownIcon,
  GaugeIcon,
  GitBranchIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  type LucideIcon,
  MenuIcon,
  MessageSquareIcon,
  RefreshCcwIcon,
  SettingsIcon,
  ShieldIcon,
  UserRoundCogIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { buildLoginPath, USER_HOME_PATH } from "@/lib/auth-entry";
import { cn } from "@/lib/utils";
import {
  type AdminProfile,
  clearAdminAuthToken,
  getAdminAuthToken,
  getAdminSelf,
  logoutAdmin,
  syncAdminAuthCookieFromStorage,
} from "@/services/admin";
import { clearAuthToken, getAuthToken, logoutUser } from "@/services/auth";

export const ADMIN_ENV_OPTIONS = ["prod", "staging", "dev"] as const;
export type AdminEnvironment = (typeof ADMIN_ENV_OPTIONS)[number];

export const ADMIN_WINDOW_OPTIONS = [
  { value: "1h", label: "1h", grafanaFrom: "now-1h" },
  { value: "24h", label: "24h", grafanaFrom: "now-24h" },
  { value: "7d", label: "7d", grafanaFrom: "now-7d" },
] as const;
export type AdminWindowValue = (typeof ADMIN_WINDOW_OPTIONS)[number]["value"];

export const ADMIN_SURFACE_OPTIONS = [
  { value: "dashboard_recommend", label: "首页推荐" },
  { value: "search_recommend", label: "搜索推荐" },
  { value: "detail_related", label: "详情相关推荐" },
] as const;
export type AdminSurfaceValue = (typeof ADMIN_SURFACE_OPTIONS)[number]["value"];

export interface AdminShellControls {
  environment: AdminEnvironment;
  isRefreshing?: boolean;
  onEnvironmentChange: (value: AdminEnvironment) => void;
  onRefresh?: () => void;
  onSurfaceChange: (value: AdminSurfaceValue) => void;
  onWindowChange: (value: AdminWindowValue) => void;
  surface: AdminSurfaceValue;
  windowValue: AdminWindowValue;
}

interface AdminShellProps {
  actions?: ReactNode;
  children: ReactNode;
  controls?: AdminShellControls;
  description?: string;
  eyebrow?: string;
  title: string;
}

const navItems: Array<{
  href: string;
  icon: LucideIcon;
  id: string;
  label: string;
  match?: "exact";
}> = [
  { href: "/admin", id: "overview", label: "总览", icon: LayoutDashboardIcon, match: "exact" },
  {
    href: "/admin/recommendation-metrics",
    id: "recommendation",
    label: "推荐指标",
    icon: ActivityIcon,
  },
  { href: "/admin/traces", id: "traces", label: "链路追踪", icon: GitBranchIcon },
  { href: "/admin/alerts", id: "alerts", label: "告警", icon: BellIcon },
  { href: "/admin/users", id: "users", label: "用户", icon: UsersIcon },
  { href: "/admin/messages", id: "messages", label: "消息", icon: MessageSquareIcon },
  { href: "/admin/profile", id: "settings", label: "设置", icon: SettingsIcon },
] as const;

const isNavActive = (pathname: string, href: string, match?: string): boolean => {
  if (match === "exact") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};

export function AdminShell({
  actions,
  children,
  controls,
  description,
  eyebrow,
  title,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isModeSwitchOpen, setIsModeSwitchOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsModeSwitchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = syncAdminAuthCookieFromStorage() ?? getAdminAuthToken();
    if (!token) {
      setAdmin(null);
      return;
    }

    let cancelled = false;
    const loadAdmin = async () => {
      try {
        const response = await getAdminSelf(token);
        if (!cancelled) {
          setAdmin(response.admin ?? null);
        }
      } catch {
        if (!cancelled) {
          setAdmin(null);
        }
      }
    };

    void loadAdmin();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeLabel = useMemo(
    () => navItems.find((item) => isNavActive(pathname, item.href, item.match))?.label ?? "管理",
    [pathname],
  );
  const activeNavId = useMemo(
    () => navItems.find((item) => isNavActive(pathname, item.href, item.match))?.id ?? "overview",
    [pathname],
  );

  const handleLogout = async () => {
    const token = getAdminAuthToken();
    const userToken = getAuthToken();

    setIsLoggingOut(true);
    try {
      await Promise.allSettled([
        token ? logoutAdmin(token) : Promise.resolve({ success: true }),
        userToken ? logoutUser(userToken) : Promise.resolve({ success: true }),
      ]);
    } finally {
      clearAdminAuthToken();
      clearAuthToken();
      setIsLoggingOut(false);
      router.push(buildLoginPath({ role: "admin" }));
    }
  };

  const renderNav = (mode: "desktop" | "mobile") => (
    <nav className={cn("space-y-1", mode === "mobile" && "px-3 pb-3")}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activeNavId === item.id;
        return (
          <Link
            key={`${mode}-${item.href}`}
            href={item.href}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-sky-500/15 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
            )}
          >
            <Icon className={cn("size-4", active ? "text-sky-300" : "text-slate-500")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const renderModeSwitcher = (mode: "desktop" | "mobile") => (
    <div className={cn("relative", mode === "mobile" && "min-w-0")}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-md text-left transition-colors",
          mode === "desktop"
            ? "px-2 py-2 text-white hover:bg-slate-900"
            : "max-w-[11rem] px-2 py-1.5 text-slate-950 hover:bg-slate-100 sm:max-w-[14rem]",
        )}
        aria-expanded={isModeSwitchOpen}
        aria-haspopup="menu"
        onClick={() => setIsModeSwitchOpen((open) => !open)}
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            mode === "desktop" ? "bg-sky-500/15 text-sky-300" : "bg-sky-50 text-sky-700",
          )}
        >
          <ShieldIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-semibold",
              mode === "desktop" ? "text-white" : "text-slate-950",
            )}
          >
            管理员中心
          </span>
          <span
            className={cn(
              "block truncate text-xs",
              mode === "desktop" ? "text-slate-500" : "text-slate-500",
            )}
          >
            点击切换模式
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            isModeSwitchOpen && "rotate-180",
            mode === "desktop" ? "text-slate-500" : "text-slate-400",
          )}
        />
      </button>

      {isModeSwitchOpen ? (
        <div
          className={cn(
            "absolute left-0 z-50 mt-2 w-52 overflow-hidden rounded-md border shadow-xl",
            mode === "desktop" ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white",
          )}
          role="menu"
        >
          <Link
            href={USER_HOME_PATH}
            className={cn(
              "block px-3 py-2.5 text-sm font-semibold transition-colors",
              mode === "desktop"
                ? "text-slate-100 hover:bg-slate-800"
                : "text-slate-800 hover:bg-slate-50",
            )}
            role="menuitem"
          >
            进入用户模式
          </Link>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-slate-800 bg-slate-950 lg:flex lg:flex-col">
        <div className="border-b border-slate-800 px-5 py-4">{renderModeSwitcher("desktop")}</div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{renderNav("desktop")}</div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-col gap-3 px-4 py-3 lg:px-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-md lg:hidden"
                aria-label={isMobileNavOpen ? "关闭管理员导航" : "打开管理员导航"}
                onClick={() => setIsMobileNavOpen((open) => !open)}
              >
                {isMobileNavOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
              </Button>
              <div className="lg:hidden">{renderModeSwitcher("mobile")}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <GaugeIcon className="size-3.5 text-sky-600" />
                  <span>{eyebrow ?? activeLabel}</span>
                </div>
                <h1 className="truncate text-lg font-semibold text-slate-950">{title}</h1>
                {description ? (
                  <p className="hidden truncate text-xs text-slate-500 sm:block">{description}</p>
                ) : null}
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {controls ? (
                <>
                  <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5">
                    {ADMIN_ENV_OPTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => controls.onEnvironmentChange(item)}
                        className={cn(
                          "h-8 rounded px-2.5 text-xs font-semibold transition-colors",
                          controls.environment === item
                            ? "bg-slate-950 text-white"
                            : "text-slate-600 hover:bg-white",
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <label className="relative">
                    <span className="sr-only">推荐场景</span>
                    <select
                      value={controls.surface}
                      onChange={(event) =>
                        controls.onSurfaceChange(event.target.value as AdminSurfaceValue)
                      }
                      className="h-9 appearance-none rounded-md border border-slate-200 bg-white pr-8 pl-3 text-xs font-semibold text-slate-700 transition-colors outline-none hover:border-slate-300 focus:border-sky-500"
                    >
                      {ADMIN_SURFACE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-slate-400" />
                  </label>

                  <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5">
                    {ADMIN_WINDOW_OPTIONS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => controls.onWindowChange(item.value)}
                        className={cn(
                          "h-8 rounded px-2.5 text-xs font-semibold transition-colors",
                          controls.windowValue === item.value
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-600 hover:bg-white/80",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-md"
                    onClick={controls.onRefresh}
                    disabled={controls.isRefreshing}
                    aria-label="刷新监控数据"
                    title="刷新"
                  >
                    <RefreshCcwIcon
                      className={cn("size-4", controls.isRefreshing && "animate-spin")}
                    />
                  </Button>
                </>
              ) : null}

              {actions}

              <div className="hidden h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-600 md:flex">
                <UserRoundCogIcon className="size-4 text-slate-400" />
                <span className="max-w-24 truncate font-semibold text-slate-800">
                  {admin?.username ?? "admin"}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-md border-rose-200 text-rose-600 hover:bg-rose-50"
                onClick={handleLogout}
                disabled={isLoggingOut}
                aria-label="退出登录"
                title="退出登录"
              >
                <LogOutIcon className="size-4" />
              </Button>
            </div>
          </div>

          {isMobileNavOpen ? (
            <div className="border-t border-slate-800 bg-slate-950 lg:hidden">
              {renderNav("mobile")}
            </div>
          ) : null}
        </header>

        <main className="min-h-[calc(100vh-4rem)] min-w-0 overflow-x-hidden px-4 py-4 lg:px-5">
          {children}
        </main>
      </div>
    </div>
  );
}
