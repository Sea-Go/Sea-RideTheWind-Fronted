"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { markNavigationStart } from "@/components/motion/navigation-timing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AuthRole, buildOnboardingQuestionnairePath, getSafeNextPath } from "@/lib/auth-entry";
import { clearAdminAuthToken, createAdmin, loginAdmin, saveAdminAuthToken } from "@/services/admin";
import {
  clearAuthToken,
  ensureUserSession,
  loginUser,
  registerUser,
  saveAuthToken,
} from "@/services/auth";

interface RegisterFormProps {
  role: AuthRole;
  onRoleChange: (role: AuthRole) => void;
}

const roleOptions: Array<{ value: AuthRole; label: string }> = [
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
];

export function RegisterForm({ role, onRoleChange }: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [inviteCode, setInviteCode] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    const normalizedInviteCode = inviteCode.trim();

    if (!normalizedUsername || !normalizedPassword) {
      setErrorMessage("请输入用户名和密码。");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("两次输入的密码不一致。");
      return;
    }

    if (role === "admin" && !normalizedInviteCode) {
      setErrorMessage("管理员注册需要邀请码。");
      return;
    }

    setLoading(true);

    try {
      if (role === "admin") {
        await createAdmin({
          username: normalizedUsername,
          password: normalizedPassword,
          email: normalizedEmail || undefined,
          invite_code: normalizedInviteCode,
          extra_info: position.trim() ? { position: position.trim() } : undefined,
        });

        const { token } = await loginAdmin({
          username: normalizedUsername,
          password: normalizedPassword,
        });

        saveAdminAuthToken(token);
        clearAuthToken();

        try {
          await ensureUserSession({
            username: normalizedUsername,
            password: normalizedPassword,
            email: normalizedEmail || undefined,
          });
          const redirectPath = getSafeNextPath("admin", searchParams.get("next"));
          markNavigationStart(redirectPath);
          router.push(redirectPath);
          return;
        } catch (syncError) {
          console.warn("admin register user-session sync failed:", syncError);
          markNavigationStart("/admin");
          router.push("/admin");
          return;
        }
      }

      await registerUser({
        username: normalizedUsername,
        password: normalizedPassword,
        email: normalizedEmail || undefined,
      });

      try {
        const { token } = await loginUser({
          username: normalizedUsername,
          password: normalizedPassword,
        });
        clearAdminAuthToken();
        saveAuthToken(token);
        const redirectPath = buildOnboardingQuestionnairePath(
          getSafeNextPath("user", searchParams.get("next")),
        );
        markNavigationStart(redirectPath);
        router.push(redirectPath);
        return;
      } catch {
        setSuccessMessage("注册成功，请使用新账号登录。");
      }

      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "注册失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="app-surface-elevated w-full max-w-[380px] shadow-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-3xl">注册</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label>注册身份</Label>
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
            <Label htmlFor="register-username">用户名</Label>
            <Input
              id="register-username"
              placeholder={role === "admin" ? "请输入管理员用户名" : "请输入用户名"}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="register-email">邮箱</Label>
            <Input
              id="register-email"
              type="email"
              placeholder="可选，用于接收通知"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {role === "admin" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="register-position">职位</Label>
                <Input
                  id="register-position"
                  placeholder="可选，例如内容审核、运营、技术支持"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="register-invite-code">邀请码</Label>
                <Input
                  id="register-invite-code"
                  placeholder="请输入管理员邀请码"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                />
              </div>
            </>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="register-password">密码</Label>
            <div className="relative">
              <Input
                id="register-password"
                type={passwordVisible ? "text" : "password"}
                placeholder="请输入密码"
                autoComplete="new-password"
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

          <div className="grid gap-2">
            <Label htmlFor="register-confirm-password">确认密码</Label>
            <div className="relative">
              <Input
                id="register-confirm-password"
                type={confirmPasswordVisible ? "text" : "password"}
                placeholder="请再次输入密码"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setConfirmPasswordVisible((visible) => !visible)}
                aria-label={confirmPasswordVisible ? "隐藏确认密码" : "显示确认密码"}
              >
                {confirmPasswordVisible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" className="h-10 w-[128px]" disabled={loading}>
              {loading ? "提交中..." : role === "admin" ? "管理员注册" : "用户注册"}
            </Button>
            {errorMessage ? (
              <p className="text-destructive text-sm leading-none" role="alert">
                {errorMessage}
              </p>
            ) : null}
            {successMessage ? (
              <p className="text-primary text-sm leading-none" role="status">
                {successMessage}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
