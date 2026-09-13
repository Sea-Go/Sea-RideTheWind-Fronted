"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  clearAdminAuthToken,
  getAdminAuthToken,
  syncAdminAuthCookieFromStorage,
} from "@/services/admin";
import { clearAuthToken, getAuthToken, syncAuthCookieFromStorage } from "@/services/auth";

import type { Theme } from "../data/types";
import {
  BookOpen,
  ChevronDown,
  Compass,
  Menu,
  MessageCircle,
  Mountain,
  Search,
  Sparkles,
  Telescope,
  Waves,
  X,
} from "./icons";

import "../sea.css";
interface Context {
  demo: boolean;
  ready: boolean;
  theme: Theme;
  href: (path: string) => string;
}
const SeaContext = createContext<Context>({
  demo: false,
  ready: false,
  theme: "mountain",
  href: (p) => p,
});
export const useSea = () => useContext(SeaContext);
const themes = [
  { id: "mountain", label: "神圣雪山", icon: Mountain },
  { id: "planetarium", label: "天文馆", icon: Telescope },
  { id: "summer", label: "蝉鸣夏夜", icon: Sparkles },
] as const;
const subscribeBrowserState = (change: () => void) => {
  window.addEventListener("storage", change);
  window.addEventListener("popstate", change);
  window.addEventListener("sea-session-change", change);
  return () => {
    window.removeEventListener("storage", change);
    window.removeEventListener("popstate", change);
    window.removeEventListener("sea-session-change", change);
  };
};
const sessionSnapshot = () => `${Boolean(getAuthToken())}:${Boolean(getAdminAuthToken())}`;
const routeThemeSnapshot = (): Theme => {
  const theme = new URLSearchParams(window.location.search).get("theme");
  return theme === "summer" || theme === "planetarium" ? theme : "mountain";
};
export function SeaShell({
  children,
  legacy = false,
  initialDemo = false,
  initialTheme = "mountain",
  hideFooter = false,
  mainClassName = "",
}: {
  children: ReactNode;
  legacy?: boolean;
  initialDemo?: boolean;
  initialTheme?: Theme;
  hideFooter?: boolean;
  mainClassName?: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const theme = useSyncExternalStore(subscribeBrowserState, routeThemeSnapshot, () => initialTheme);
  const session = useSyncExternalStore(subscribeBrowserState, sessionSnapshot, () => "false:false");
  const [hasUser, hasAdmin] = session.split(":").map((value) => value === "true");
  const demo = initialDemo;
  const ready = true;
  const [menu, setMenu] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    syncAuthCookieFromStorage();
    syncAdminAuthCookieFromStorage();
    window.dispatchEvent(new Event("sea-session-change"));
  }, []);
  const href = (target: string) => {
    const url = new URL(target, "https://sea.invalid");
    url.searchParams.set("theme", theme);
    if (demo) url.searchParams.set("demo", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  };
  const changeTheme = (t: Theme) => {
    try {
      localStorage.setItem("sea-theme", t);
    } catch {
      /* URL remains authoritative. */
    }
    setThemeOpen(false);
    const u = new URL(location.href);
    u.searchParams.set("theme", t);
    history.replaceState(null, "", u);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const logout = () => {
    const login = hasAdmin && !hasUser ? "/login?role=admin" : "/login";
    clearAuthToken();
    clearAdminAuthToken();
    window.dispatchEvent(new Event("sea-session-change"));
    setAccountOpen(false);
    router.push(login);
    router.refresh();
  };
  const links = [
    { href: "/", label: "探索", icon: Compass },
    { href: "/community", label: "社区", icon: Waves },
    { href: "/knowledge", label: "知识", icon: BookOpen },
    { href: "/learn", label: "学习对话", icon: MessageCircle },
  ];
  return (
    <SeaContext.Provider value={{ demo, ready, theme, href }}>
      <div className={`sea-app ${legacy ? "sea-legacy" : ""}`} data-sea-theme={theme}>
        <a className="sea-skip" href="#sea-main">
          跳到主要内容
        </a>
        <header className="sea-header">
          <Link prefetch={false} href={href("/")} className="sea-brand" aria-label="Sea 识海首页">
            <Waves size={28} />
            <strong>
              Sea<span>识海</span>
            </strong>
          </Link>
          <nav className={menu ? "sea-nav open" : "sea-nav"} aria-label="主要导航">
            {links.map((l) => (
              <Link
                prefetch={false}
                key={l.href}
                href={href(l.href)}
                onFocus={() => router.prefetch(href(l.href))}
                onPointerEnter={() => router.prefetch(href(l.href))}
                className={
                  path === l.href || (l.href === "/knowledge" && path.startsWith("/knowledge"))
                    ? "active"
                    : ""
                }
                onClick={() => setMenu(false)}
              >
                {l.label}
                {l.href === "/learn" && <span className="sea-ai">AI</span>}
              </Link>
            ))}
          </nav>
          <div className="sea-header-tools">
            <Link prefetch={false} className="sea-search-shortcut" href={href("/search")}>
              <Search size={16} />
              <span>搜索你想了解的</span>
              <kbd>⌘ K</kbd>
            </Link>
            <div className="sea-theme-picker">
              <button
                aria-label="选择视觉主题"
                aria-expanded={themeOpen}
                className="sea-icon-button"
                onClick={() => {
                  setThemeOpen(!themeOpen);
                  setAccountOpen(false);
                }}
              >
                <Mountain size={18} />
                <ChevronDown size={12} />
              </button>
              {themeOpen && (
                <div className="sea-theme-menu">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      aria-pressed={theme === t.id}
                      onClick={() => changeTheme(t.id)}
                    >
                      <t.icon size={16} />
                      {t.label}
                      <span>{theme === t.id ? "✓" : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="sea-account-picker">
              <button
                className="sea-avatar"
                aria-label="打开账号与个人空间菜单"
                aria-expanded={accountOpen}
                onClick={() => {
                  setAccountOpen(!accountOpen);
                  setThemeOpen(false);
                }}
              >
                {demo ? "林" : "我"}
              </button>
              {accountOpen && (
                <div className="sea-account-menu">
                  {[
                    ["/profile", "个人空间"],
                    ["/interests", "我的兴趣"],
                    ["/profile/favorites", "我的收藏"],
                    ["/profile/follow", "我的关注"],
                    ["/profile/articles", "文章管理"],
                    ["/messages", "评论与消息"],
                    ["/editor", "发布文章"],
                    ["/dashboard/travel-agent", "旅行探索"],
                    ...(hasAdmin ? [["/admin", "管理员中心"]] : []),
                  ].map(([target, label]) => (
                    <Link
                      prefetch={false}
                      key={target}
                      href={href(target)}
                      onClick={() => setAccountOpen(false)}
                    >
                      {label}
                    </Link>
                  ))}
                  {hasUser || hasAdmin ? (
                    <button onClick={logout}>退出登录</button>
                  ) : (
                    <Link prefetch={false} href={`/login?next=${encodeURIComponent(path)}`}>
                      登录
                    </Link>
                  )}
                </div>
              )}
            </div>
            <button
              className="sea-menu-toggle sea-icon-button"
              aria-label={menu ? "关闭菜单" : "打开菜单"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </header>
        {demo && (
          <div className="sea-demo-bar">
            <span>设计演示</span> 内容、对话与发布状态均为示例 · 不连接生产业务{" "}
            <a href={path}>查看真实接入状态 ↗</a>
          </div>
        )}
        <main id="sea-main" className={`sea-main ${mainClassName}`} tabIndex={-1}>
          {children}
        </main>
        {!hideFooter && (
          <footer className="sea-footer">
            <Link prefetch={false} href={href("/")} className="sea-brand small">
              <Waves size={22} />
              <strong>
                Sea<span>让好奇心，自由生长。</span>
              </strong>
            </Link>
            <div>
              <Link prefetch={false} href={href("/dashboard/travel-agent")}>
                旅行探索 ↗
              </Link>
              <Link prefetch={false} href={href("/profile")}>
                个人空间
              </Link>
              <Link prefetch={false} href={href("/knowledge/workbench")}>
                知识工作台
              </Link>
              <Link prefetch={false} href={href("/companion")}>
                WhaleHall 桌宠 ↗
              </Link>
            </div>
            <span>与世界保持好奇 · 2026</span>
          </footer>
        )}
        <KeyboardSearch href={href("/search")} />
      </div>
    </SeaContext.Provider>
  );
}
function KeyboardSearch({ href }: { href: string }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        location.assign(href);
      }
    };
    addEventListener("keydown", f);
    return () => removeEventListener("keydown", f);
  }, [href]);
  return null;
}
