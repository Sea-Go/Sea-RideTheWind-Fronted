"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { markNavigationStart } from "@/components/motion/navigation-timing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AuthRole, getSafeNextPath } from "@/lib/auth-entry";
import { clearAdminAuthToken, loginAdmin, saveAdminAuthToken } from "@/services/admin";
import { clearAuthToken, ensureUserSession, loginUser, saveAuthToken } from "@/services/auth";

interface LoginFormProps {
  role: AuthRole;
  onRoleChange: (role: AuthRole) => void;
}

const roleOptions: Array<{ value: AuthRole; label: string }> = [
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
];

export function LoginForm({ role, onRoleChange }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setErrorMessage(null);
  }, [role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setErrorMessage("请输入用户名和密码。");
      return;
    }

    setLoading(true);

    try {
      let redirectPath = getSafeNextPath(role, searchParams.get("next"));

      if (role === "admin") {
        const { token } = await loginAdmin({
          username: normalizedUsername,
          password,
        });

        saveAdminAuthToken(token);
        clearAuthToken();

        try {
          await ensureUserSession({
            username: normalizedUsername,
            password,
          });
        } catch (syncError) {
          console.warn("admin user-session sync failed:", syncError);
          redirectPath = "/admin";
        }
      } else {
        const { token } = await loginUser({
          username: normalizedUsername,
          password,
        });

        clearAdminAuthToken();
        saveAuthToken(token);
      }

      markNavigationStart(redirectPath);
      router.push(redirectPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="app-surface-elevated w-full max-w-[380px] shadow-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-3xl">登录</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label>登录身份</Label>
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.map((option) => {
                const active = role === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onRoleChange(option.value)}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-foreground shadow-sm shadow-sky-500/10"
                        : "border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/40"
                    }`}
                  >
                    <div className="text-sm font-medium">{option.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="login-username">用户名</Label>
            <Input
              id="login-username"
              placeholder={role === "admin" ? "请输入管理员用户名" : "请输入用户名"}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="login-password">密码</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={passwordVisible ? "text" : "password"}
                placeholder="请输入密码"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setPasswordVisible((visible) => !visible)}
                aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
              >
                {passwordVisible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" className="h-10 w-[136px]" disabled={loading}>
              {loading ? "登录中..." : role === "admin" ? "管理员登录" : "用户登录"}
            </Button>
            {errorMessage ? (
              <p className="text-destructive text-sm leading-none" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
