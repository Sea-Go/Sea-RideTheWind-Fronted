"use client";

import { ArrowRightIcon, Settings2Icon, ShieldCheckIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { InteractiveSurface } from "@/components/motion/InteractiveSurface";
import { ProfileThemePicker, ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { Button } from "@/components/ui/button";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  type FrontendAccessState,
  getFrontendAccessState,
} from "@/services/auth";

let cachedAccessState: FrontendAccessState | null = null;
let cachedAccessStateKey = "";

const subscribeFrontendAccessState = (onStoreChange: () => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("focus", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("focus", onStoreChange);
  };
};

const getFrontendAccessSnapshot = (): FrontendAccessState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const nextAccessState = getFrontendAccessState();
  const nextKey = `${nextAccessState.userToken ?? ""}|${nextAccessState.adminToken ?? ""}`;
  if (cachedAccessState && cachedAccessStateKey === nextKey) {
    return cachedAccessState;
  }

  cachedAccessState = nextAccessState;
  cachedAccessStateKey = nextKey;
  return cachedAccessState;
};

const getServerFrontendAccessSnapshot = (): FrontendAccessState | null => null;

export default function SettingsPage() {
  const router = useRouter();
  const accessState = useSyncExternalStore(
    subscribeFrontendAccessState,
    getFrontendAccessSnapshot,
    getServerFrontendAccessSnapshot,
  );
  const accessMessage =
    accessState && !accessState.userToken ? ADMIN_FRONTEND_SESSION_MESSAGE : null;

  useEffect(() => {
    if (accessState && !accessState.hasFrontendAccess) {
      router.replace("/login?next=/settings");
    }
  }, [accessState, router]);

  return (
    <Layout>
      <PageContainer className="py-8">
        <ProfileThemeShell className="space-y-8">
          <header className="app-hero-surface grid gap-4 rounded-[1.75rem] p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div className="space-y-3">
              <div className="app-pill text-muted-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                <Settings2Icon className="h-3.5 w-3.5" />
                设置
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  把个性化和账户操作收进同一个页面
                </h1>
              </div>
            </div>

            <div className="app-surface-soft rounded-[1.4rem] p-4">
              <p className="text-muted-foreground text-xs tracking-[0.22em] uppercase">当前范围</p>
              <p className="mt-2 text-sm font-medium">全站界面</p>
            </div>
          </header>

          {!accessState || !accessState.hasFrontendAccess ? (
            <section className="app-surface rounded-[1.75rem] p-6">
              <p className="text-muted-foreground">正在加载设置...</p>
            </section>
          ) : accessMessage ? (
            <section className="app-surface space-y-4 rounded-[1.75rem] p-6">
              <h2 className="text-xl font-semibold tracking-tight">当前无法进入设置</h2>
              <p className="text-muted-foreground text-sm leading-6">{accessMessage}</p>
              <Button asChild>
                <Link href="/login">重新登录</Link>
              </Button>
            </section>
          ) : (
            <>
              <ProfileThemePicker />

              <section className="grid gap-4 lg:grid-cols-2">
                <InteractiveSurface asChild variant="card">
                  <Link
                    href="/profile"
                    className="app-surface group relative overflow-hidden rounded-[1.75rem] p-6"
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, color-mix(in oklab, var(--primary) 16%, transparent), color-mix(in oklab, var(--card) 18%, transparent))",
                      }}
                    />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <span className="bg-primary/12 text-primary ring-border/60 inline-flex h-14 w-14 items-center justify-center rounded-[1.3rem] shadow-sm ring-1">
                          <UserIcon className="h-7 w-7" />
                        </span>
                        <ArrowRightIcon className="text-muted-foreground group-hover:text-primary h-5 w-5 transition-colors" />
                      </div>
                      <div className="mt-auto space-y-2 pt-10">
                        <h2 className="text-2xl font-semibold tracking-tight">返回个人中心</h2>
                      </div>
                    </div>
                  </Link>
                </InteractiveSurface>

                <InteractiveSurface asChild variant="card">
                  <Link
                    href="/profile/security"
                    className="app-surface group relative overflow-hidden rounded-[1.75rem] p-6"
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, color-mix(in oklab, var(--accent) 70%, transparent), color-mix(in oklab, var(--card) 18%, transparent))",
                      }}
                    />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <span className="bg-primary/12 text-primary ring-border/60 inline-flex h-14 w-14 items-center justify-center rounded-[1.3rem] shadow-sm ring-1">
                          <ShieldCheckIcon className="h-7 w-7" />
                        </span>
                        <ArrowRightIcon className="text-muted-foreground group-hover:text-primary h-5 w-5 transition-colors" />
                      </div>
                      <div className="mt-auto space-y-2 pt-10">
                        <h2 className="text-2xl font-semibold tracking-tight">安全设置</h2>
                      </div>
                    </div>
                  </Link>
                </InteractiveSurface>
              </section>
            </>
          )}
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
