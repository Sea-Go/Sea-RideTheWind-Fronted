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
  };

  const registerFormStyle: CSSProperties = {
    opacity: isSignUpMode ? 1 : 0,
    zIndex: isSignUpMode ? 2 : 1,
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
        <div className="relative min-h-screen w-full overflow-hidden bg-[var(--app-body-background)]">
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
                  <LoginForm role={authRole} onRoleChange={(role) => updateView("login", role)} />
                </div>

                <div
                  className="col-start-1 row-start-1 flex items-center justify-center overflow-hidden"
                  style={{ ...registerFormStyle, transition: "opacity 0.2s ease 0.7s" }}
                >
                  <RegisterForm
                    role={authRole}
                    onRoleChange={(role) => updateView("register", role)}
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

          <div className="auth-beian text-muted-foreground absolute right-0 bottom-[14px] left-0 z-20 text-center text-xs">
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
