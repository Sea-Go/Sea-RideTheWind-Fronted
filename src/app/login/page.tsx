"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { type CSSProperties, Suspense, useEffect } from "react";

import { LoginForm } from "@/app/login/_components/LoginForm";
import { RegisterForm } from "@/app/login/_components/RegisterForm";
import etihwImg from "@/assets/images/etihw.jpg";
import whiteImg from "@/assets/images/white.jpg";
import { MotionPage } from "@/components/motion/MotionPage";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Button } from "@/components/ui/button";
import {
  type AuthMode,
  type AuthRole,
  buildLoginPath,
  getSafeNextPath,
  normalizeAuthMode,
  normalizeAuthRole,
} from "@/lib/auth-entry";
import { getAdminAuthToken, syncAdminAuthCookieFromStorage } from "@/services/admin";
import { getAuthToken, syncAuthCookieFromStorage } from "@/services/auth";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authRole = normalizeAuthRole(searchParams.get("role"));
  const authMode = normalizeAuthMode(searchParams.get("mode"));
  const next = searchParams.get("next");
  const isSignUpMode = authMode === "register";

  useEffect(() => {
    const userToken = syncAuthCookieFromStorage() ?? getAuthToken();
    const adminToken = syncAdminAuthCookieFromStorage() ?? getAdminAuthToken();

    if (userToken) {
      router.replace(getSafeNextPath("user", next));
      return;
    }

    if (adminToken) {
      router.replace(getSafeNextPath("admin", next));
    }
  }, [next, router]);

  const updateView = (mode: AuthMode, role: AuthRole = authRole) => {
    router.replace(buildLoginPath({ role, mode, next }), { scroll: false });
  };

  const circleStyle: CSSProperties = isSignUpMode
    ? {
        top: "-10%",
        right: "60%",
        bottom: "initial",
        left: "initial",
        transform: "translate(100%, -50%)",
        width: "2000px",
        height: "2000px",
      }
    : {
        top: "-10%",
        right: "40%",
        bottom: "initial",
        left: "initial",
        transform: "translate(0%, -50%)",
        width: "2000px",
        height: "2000px",
      };

  const formStyle: CSSProperties = isSignUpMode
    ? { left: "25%", top: "50%", transform: "translate(-50%, -50%)" }
    : { left: "75%", top: "50%", transform: "translate(-50%, -50%)" };

  const loginFormStyle: CSSProperties = {
    opacity: isSignUpMode ? 0 : 1,
    zIndex: isSignUpMode ? 1 : 2,
    pointerEvents: isSignUpMode ? "none" : "auto",
  };

  const registerFormStyle: CSSProperties = {
    opacity: isSignUpMode ? 1 : 0,
    zIndex: isSignUpMode ? 2 : 1,
    pointerEvents: isSignUpMode ? "auto" : "none",
  };

  const leftPanelStyle: CSSProperties = {
    opacity: isSignUpMode ? 0 : 1,
    transform: `translateX(${isSignUpMode ? -800 : 0}px)`,
  };
  const rightPanelStyle: CSSProperties = {
    opacity: isSignUpMode ? 1 : 0,
    transform: `translateX(${isSignUpMode ? 0 : 800}px)`,
  };

  return (
    <MotionProvider className="min-h-screen">
      <MotionPage>
        <div className="min-h-[100dvh] bg-[var(--app-body-background)]">
          <div className="flex min-h-[100dvh] flex-col md:hidden">
            <section className="from-primary to-primary/75 text-primary-foreground relative flex min-h-[34dvh] overflow-hidden bg-gradient-to-br px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-7">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-white/20 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-28 -left-16 size-60 rounded-full bg-sky-200/25 blur-3xl"
              />
              <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold tracking-[0.18em] uppercase opacity-80">
                    识海社区
                  </p>
                  <h1 className="mt-3 text-3xl leading-tight font-black tracking-tight">
                    {isSignUpMode ? "创建你的内容身份" : "欢迎回到识海"}
                  </h1>
                  <p className="text-primary-foreground/82 mt-3 max-w-[18rem] text-sm leading-6">
                    {isSignUpMode
                      ? "注册后进入问卷，让推荐和旅行规划更懂你的偏好。"
                      : "登录后继续浏览推荐、评论文章和使用旅行 Agent。"}
                  </p>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div className="rounded-2xl border border-white/25 bg-white/14 px-3 py-2 text-xs font-semibold backdrop-blur">
                    {authRole === "admin" ? "管理员入口" : "普通用户入口"}
                  </div>
                  <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/20 shadow-xl shadow-sky-900/20">
                    <Image
                      src={isSignUpMode ? etihwImg : whiteImg}
                      alt={isSignUpMode ? "注册引导" : "登录引导"}
                      fill
                      sizes="112px"
                      className="object-cover"
                      placeholder="blur"
                    />
                  </div>
                </div>
              </div>
            </section>

            <main className="relative z-20 -mt-5 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="mx-auto w-full max-w-[430px] space-y-3">
                <div className="app-surface-elevated grid grid-cols-2 gap-1 rounded-full p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => updateView("login")}
                    className={`h-10 rounded-full text-sm font-semibold transition ${
                      !isSignUpMode
                        ? "bg-primary text-primary-foreground shadow-primary/20 shadow-md"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    onClick={() => updateView("register")}
                    className={`h-10 rounded-full text-sm font-semibold transition ${
                      isSignUpMode
                        ? "bg-primary text-primary-foreground shadow-primary/20 shadow-md"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    注册
                  </button>
                </div>

                {isSignUpMode ? (
                  <RegisterForm
                    role={authRole}
                    onRoleChange={(role) => updateView("register", role)}
                    idPrefix="mobile-register"
                    className="max-w-none"
                  />
                ) : (
                  <LoginForm
                    role={authRole}
                    onRoleChange={(role) => updateView("login", role)}
                    idPrefix="mobile-login"
                    className="max-w-none"
                  />
                )}

                <div className="auth-beian text-muted-foreground py-2 text-center text-xs">
                  <a
                    href="#"
                    className="hover:text-primary hover:bg-accent/70 rounded-full px-3 py-1 transition-colors"
                  >
                    备案号 14514
                  </a>
                </div>
              </div>
            </main>
          </div>

          <div className="relative hidden min-h-screen w-full overflow-hidden md:block">
            <div className="absolute inset-0 h-full w-full">
              <div
                className="from-primary absolute z-[6] rounded-full bg-gradient-to-tr to-sky-400 shadow-2xl shadow-sky-700/20"
                style={{
                  ...circleStyle,
                  transition: "all 1.8s ease-in-out",
                  backgroundImage:
                    "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--app-surface-elevated) 28%, transparent), transparent 22%), linear-gradient(-45deg, var(--primary) 0%, #4fb2f4 100%)",
                }}
              />

              <div className="absolute top-0 left-0 h-full w-full">
                <div
                  className="absolute z-[5] grid w-full max-w-[500px] grid-cols-1 md:w-1/2"
                  style={{ ...formStyle, transition: "all 1s ease-in-out 0.7s" }}
                >
                  <div
                    className="col-start-1 row-start-1 flex items-center justify-center overflow-hidden"
                    style={{ ...loginFormStyle, transition: "opacity 0.2s ease 0.7s" }}
                  >
                    <LoginForm
                      role={authRole}
                      onRoleChange={(role) => updateView("login", role)}
                      idPrefix="desktop-login"
                    />
                  </div>

                  <div
                    className="col-start-1 row-start-1 flex items-center justify-center overflow-hidden"
                    style={{ ...registerFormStyle, transition: "opacity 0.2s ease 0.7s" }}
                  >
                    <RegisterForm
                      role={authRole}
                      onRoleChange={(role) => updateView("register", role)}
                      idPrefix="desktop-register"
                    />
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute top-0 left-0 grid h-full w-full grid-cols-1 grid-rows-[1fr_2fr_1fr] md:grid-cols-2 md:grid-rows-1">
                <div className="pointer-events-none z-[6] col-start-1 row-start-1 flex flex-col items-center justify-center gap-6 px-[8%] py-10 text-center md:px-[10%] md:py-0">
                  <div
                    className="text-primary-foreground pointer-events-auto flex flex-col items-center gap-4"
                    style={{ ...leftPanelStyle, transition: "all 0.9s ease-in-out 0.6s" }}
                  >
                    <h3 className="text-xl font-bold md:text-2xl">还没有账号？</h3>
                    <Button
                      variant="outline"
                      className="border-primary-foreground/70 text-primary-foreground hover:border-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 m-0 h-[41px] w-[130px] rounded-full border-2 bg-transparent text-[0.8rem] font-semibold uppercase"
                      onClick={() => updateView("register")}
                    >
                      去注册
                    </Button>
                  </div>

                  <div
                    className="pointer-events-auto hidden w-[80%] max-w-[350px] items-center justify-center md:flex"
                    style={{ ...leftPanelStyle, transition: "all 0.9s ease-in-out 0.6s" }}
                  >
                    <Image
                      src={etihwImg}
                      alt="注册引导"
                      className="h-auto w-full rounded-xl shadow-lg"
                      placeholder="blur"
                    />
                  </div>
                </div>

                <div className="pointer-events-none z-[6] col-start-1 row-start-3 flex flex-col items-center justify-center gap-6 px-[8%] py-10 text-center md:col-start-2 md:row-start-1 md:px-[10%] md:py-0">
                  <div
                    className="text-primary-foreground pointer-events-auto flex flex-col items-center gap-4"
                    style={{ ...rightPanelStyle, transition: "all 0.9s ease-in-out 0.6s" }}
                  >
                    <h3 className="text-xl font-bold md:text-2xl">已经有账号了？</h3>
                    <Button
                      variant="outline"
                      className="border-primary-foreground/70 text-primary-foreground hover:border-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 m-0 h-[41px] w-[130px] rounded-full border-2 bg-transparent text-[0.8rem] font-semibold uppercase"
                      onClick={() => updateView("login")}
                    >
                      去登录
                    </Button>
                  </div>

                  <div
                    className="pointer-events-auto hidden w-[80%] max-w-[350px] items-center justify-center md:flex"
                    style={{ ...rightPanelStyle, transition: "all 0.9s ease-in-out 0.6s" }}
                  >
                    <Image
                      src={whiteImg}
                      alt="登录引导"
                      className="h-auto w-full rounded-xl shadow-lg"
                      placeholder="blur"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-beian text-muted-foreground absolute right-0 bottom-[14px] left-0 z-20 hidden text-center text-xs md:block">
            <a
              href="#"
              className="hover:text-primary hover:bg-accent/70 rounded-full px-3 py-1 transition-colors"
            >
              备案号 14514
            </a>
          </div>
        </div>
      </MotionPage>
    </MotionProvider>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
