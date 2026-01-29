"use client";

// 注册表单组件，用于呈现基础注册交互并保持与既有样式一致。
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!username || !password) {
      setErrorMessage("请输入用户名和密码");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      // TODO: 对接注册接口
      router.push("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "注册失败，请稍后重试";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-[350px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-3xl">注册</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="register-username">用户名</Label>
            <Input
              id="register-username"
              placeholder="请输入用户名"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
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
                aria-label={confirmPasswordVisible ? "隐藏密码" : "显示密码"}
              >
                {confirmPasswordVisible ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" className="h-10 w-[120px]" disabled={loading}>
              {loading ? "注册中..." : "立即注册"}
            </Button>
            {errorMessage && (
              <p className="text-destructive text-sm leading-none" role="alert">
                {errorMessage}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
