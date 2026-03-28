"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { LoginForm } from "@/app/login/_components/LoginForm";
import { RegisterForm } from "@/app/login/_components/RegisterForm";
import etihwImg from "@/assets/images/etihw.jpg";
import whiteImg from "@/assets/images/white.jpg";
import { Button } from "@/components/ui/button";
import {
  type AuthMode,
  type AuthRole,
  buildLoginPath,
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
      router.replace(next && next.trim() ? next : "/dashboard");
      return;
    }

    if (adminToken) {
      router.replace(next && next.trim() ? next : "/admin");
    }
  }, [next, router]);

  const updateView = (mode: AuthMode, role: AuthRole = authRole) => {
    router.replace(buildLoginPath({ role, mode, next }), { scroll: false });
  };

  const circlePosition = isSignUpMode
    ? {
        top: "-10%",
        right: "60%",
        bottom: "initial",
        left: "initial",
        x: "100%",
        y: "-50%",
        width: "2000px",
        height: "2000px",
      }
    : {
        top: "-10%",
        right: "40%",
        bottom: "initial",
        left: "initial",
        x: "0%",
        y: "-50%",
        width: "2000px",
        height: "2000px",
      };

  const formPosition = isSignUpMode
    ? { left: "25%", top: "50%", x: "-50%", y: "-50%" }
    : { left: "75%", top: "50%", x: "-50%", y: "-50%" };

  const loginFormMotion = {
    opacity: isSignUpMode ? 0 : 1,
    zIndex: isSignUpMode ? 1 : 2,
  };

  const registerFormMotion = {
    opacity: isSignUpMode ? 1 : 0,
    zIndex: isSignUpMode ? 2 : 1,
  };

  const leftPanelMotion = isSignUpMode ? { x: -800, opacity: 0 } : { x: 0, opacity: 1 };
  const rightPanelMotion = isSignUpMode ? { x: 0, opacity: 1 } : { x: 800, opacity: 0 };

  return (
    <div className="bg-background relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 h-full w-full">
        <motion.div
          initial={circlePosition}
          animate={circlePosition}
          transition={{ duration: 1.8, ease: "easeInOut" }}
          className="from-primary to-primary/80 absolute z-[6] rounded-full bg-gradient-to-tr"
          style={{
            backgroundImage:
              "linear-gradient(-45deg, var(--primary) 0%, color-mix(in oklch, var(--primary), transparent 0%) 100%)",
          }}
        />

        <div className="absolute top-0 left-0 h-full w-full">
          <motion.div
            initial={formPosition}
            animate={formPosition}
            transition={{ duration: 1, delay: 0.7, ease: "easeInOut" }}
            className="absolute z-[5] grid w-full max-w-[500px] grid-cols-1 md:w-1/2"
          >
            <motion.div
              className="col-start-1 row-start-1 flex items-center justify-center overflow-hidden"
              initial={loginFormMotion}
              animate={loginFormMotion}
              transition={{ duration: 0.2, delay: 0.7 }}
            >
              <LoginForm role={authRole} onRoleChange={(role) => updateView("login", role)} />
            </motion.div>

            <motion.div
              className="col-start-1 row-start-1 flex items-center justify-center overflow-hidden"
              initial={registerFormMotion}
              animate={registerFormMotion}
              transition={{ duration: 0.2, delay: 0.7 }}
            >
              <RegisterForm role={authRole} onRoleChange={(role) => updateView("register", role)} />
            </motion.div>
          </motion.div>
        </div>

        <div className="pointer-events-none absolute top-0 left-0 grid h-full w-full grid-cols-1 grid-rows-[1fr_2fr_1fr] md:grid-cols-2 md:grid-rows-1">
          <div className="pointer-events-none z-[6] col-start-1 row-start-1 flex flex-col items-center justify-center gap-6 px-[8%] py-10 text-center md:px-[10%] md:py-0">
            <motion.div
              className="text-primary-foreground pointer-events-auto flex flex-col items-center gap-4"
              initial={leftPanelMotion}
              animate={leftPanelMotion}
              transition={{ duration: 0.9, delay: 0.6, ease: "easeInOut" }}
            >
              <h3 className="text-xl font-bold md:text-2xl">还没有账号？</h3>
              <p className="text-sm md:text-base">
                同一个入口就能选择普通用户或管理员身份，注册后会自动进入对应空间。
              </p>
              <Button
                variant="outline"
                className="border-primary-foreground/70 text-primary-foreground hover:border-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 m-0 h-[41px] w-[130px] rounded-full border-2 bg-transparent text-[0.8rem] font-semibold uppercase"
                onClick={() => updateView("register")}
              >
                去注册
              </Button>
            </motion.div>

            <motion.div
              className="pointer-events-auto hidden w-[80%] max-w-[350px] items-center justify-center md:flex"
              initial={leftPanelMotion}
              animate={leftPanelMotion}
              transition={{ duration: 0.9, delay: 0.6, ease: "easeInOut" }}
            >
              <Image
                src={etihwImg}
                alt="注册引导"
                className="h-auto w-full rounded-xl shadow-lg"
                placeholder="blur"
              />
            </motion.div>
          </div>

          <div className="pointer-events-none z-[6] col-start-1 row-start-3 flex flex-col items-center justify-center gap-6 px-[8%] py-10 text-center md:col-start-2 md:row-start-1 md:px-[10%] md:py-0">
            <motion.div
              className="text-primary-foreground pointer-events-auto flex flex-col items-center gap-4"
              initial={rightPanelMotion}
              animate={rightPanelMotion}
              transition={{ duration: 0.9, delay: 0.6, ease: "easeInOut" }}
            >
              <h3 className="text-xl font-bold md:text-2xl">已经有账号了？</h3>
              <p className="text-sm md:text-base">
                登录前先选好身份，系统会把你带到普通用户首页或管理员中心。
              </p>
              <Button
                variant="outline"
                className="border-primary-foreground/70 text-primary-foreground hover:border-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 m-0 h-[41px] w-[130px] rounded-full border-2 bg-transparent text-[0.8rem] font-semibold uppercase"
                onClick={() => updateView("login")}
              >
                去登录
              </Button>
            </motion.div>

            <motion.div
              className="pointer-events-auto hidden w-[80%] max-w-[350px] items-center justify-center md:flex"
              initial={rightPanelMotion}
              animate={rightPanelMotion}
              transition={{ duration: 0.9, delay: 0.6, ease: "easeInOut" }}
            >
              <Image
                src={whiteImg}
                alt="登录引导"
                className="h-auto w-full rounded-xl shadow-lg"
                placeholder="blur"
              />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="auth-beian text-muted-foreground absolute right-0 bottom-[14px] left-0 z-20 text-center text-xs">
        <a
          href="#"
          className="hover:bg-muted hover:text-foreground rounded px-2 py-1 transition-colors"
        >
          备案号 14514
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
