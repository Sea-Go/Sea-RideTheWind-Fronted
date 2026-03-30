"use client";

import {
  ArrowRightIcon,
  PaletteIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileThemePicker, ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { Button } from "@/components/ui/button";
import { ADMIN_FRONTEND_SESSION_MESSAGE, getFrontendAccessState } from "@/services/auth";

export default function SettingsPage() {
  const router = useRouter();
  const accessState = typeof window === "undefined" ? null : getFrontendAccessState();
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
          <header className="border-border/80 bg-card/80 grid gap-4 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div className="space-y-3">
              <div className="text-muted-foreground border-border/80 bg-background/80 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                <Settings2Icon className="h-3.5 w-3.5" />
                设置
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  把个性化和账户操作收进同一个页面
                </h1>
                <p className="text-muted-foreground max-w-3xl text-sm leading-6">
                  个人中心里的颜色主题选择已经搬到这里。你可以在这里切换个人中心配色，也可以继续进入安全设置处理密码和退出登录等账户操作。
                </p>
              </div>
            </div>

            <div className="border-border/70 bg-background/75 rounded-[1.4rem] border p-4 shadow-sm">
              <p className="text-muted-foreground text-xs tracking-[0.22em] uppercase">当前范围</p>
              <p className="mt-2 text-sm font-medium">
                主题会同步作用到前台页面和个人中心相关区域。
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                切换后会自动记住，下次进入仍然保持。
              </p>
            </div>
          </header>

          {!accessState || !accessState.hasFrontendAccess ? (
            <section className="border-border/80 bg-card/80 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur">
              <p className="text-muted-foreground">正在加载设置...</p>
            </section>
          ) : accessMessage ? (
            <section className="border-border/80 bg-card/80 space-y-4 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur">
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
                <Link
                  href="/profile"
                  className="group border-border/80 bg-card/82 relative overflow-hidden rounded-[1.75rem] border p-6 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(255, 255, 255, 0.03))",
                    }}
                  />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <span className="bg-primary/12 text-primary inline-flex h-14 w-14 items-center justify-center rounded-[1.3rem] shadow-sm ring-1 ring-white/60">
                        <UserIcon className="h-7 w-7" />
                      </span>
                      <ArrowRightIcon className="text-muted-foreground group-hover:text-primary h-5 w-5 transition-colors" />
                    </div>
                    <div className="mt-auto space-y-2 pt-10">
                      <h2 className="text-2xl font-semibold tracking-tight">返回个人中心</h2>
                      <p className="text-muted-foreground text-sm leading-6">
                        回到个人资料、点赞入口和关注管理区域，继续处理日常内容。
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/profile/security"
                  className="group border-border/80 bg-card/82 relative overflow-hidden rounded-[1.75rem] border p-6 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-90"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(255, 255, 255, 0.03))",
                    }}
                  />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <span className="bg-primary/12 text-primary inline-flex h-14 w-14 items-center justify-center rounded-[1.3rem] shadow-sm ring-1 ring-white/60">
                        <ShieldCheckIcon className="h-7 w-7" />
                      </span>
                      <ArrowRightIcon className="text-muted-foreground group-hover:text-primary h-5 w-5 transition-colors" />
                    </div>
                    <div className="mt-auto space-y-2 pt-10">
                      <h2 className="text-2xl font-semibold tracking-tight">安全设置</h2>
                      <p className="text-muted-foreground text-sm leading-6">
                        这里继续保留高风险操作入口，比如退出登录和账户安全相关处理。
                      </p>
                    </div>
                  </div>
                </Link>
              </section>

              <section className="border-border/80 bg-card/80 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur">
                <div className="flex items-start gap-4">
                  <span className="bg-primary/12 text-primary inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                    <PaletteIcon className="h-6 w-6" />
                  </span>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight">主题说明</h2>
                    <p className="text-muted-foreground text-sm leading-6">
                      当前提供蓝白、粉白、黑白和暖黄四种风格。主题只影响界面显示，不会修改你的账号资料和业务数据。
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
