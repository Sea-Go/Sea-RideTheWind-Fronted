"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAdmin, getAdminAuthToken } from "@/services/admin";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (getAdminAuthToken()) {
      router.replace("/admin");
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();
    const normalizedInviteCode = inviteCode.trim();

    if (!normalizedUsername || !normalizedPassword) {
      setErrorMessage("请输入管理员账号和密码");
      return;
    }

    if (!normalizedInviteCode) {
      setErrorMessage("请输入管理员邀请码");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAdmin({
        username: normalizedUsername,
        password: normalizedPassword,
        email: email.trim() || undefined,
        invite_code: normalizedInviteCode,
        extra_info: position.trim() ? { position: position.trim() } : undefined,
      });

      setUsername("");
      setPassword("");
      setEmail("");
      setPosition("");
      setInviteCode("");
      setSuccessMessage("管理员账号创建成功，请前往登录");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "管理员注册失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">管理员账号注册</CardTitle>
          <p className="text-muted-foreground text-sm">
            注册管理员需要填写固定邀请码，邀请码由系统配置统一控制。
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="admin-register-username">账号</Label>
              <Input
                id="admin-register-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="请输入管理员账号"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-register-password">密码</Label>
              <Input
                id="admin-register-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="请输入管理员密码"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-register-email">邮箱</Label>
              <Input
                id="admin-register-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="可选，填写管理员邮箱"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-register-position">岗位</Label>
              <Input
                id="admin-register-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="可选，例如内容审核 / 系统运维"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-register-invite-code">邀请码</Label>
              <Input
                id="admin-register-invite-code"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="请输入固定邀请码"
              />
            </div>

            {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
            {successMessage ? <p className="text-primary text-sm">{successMessage}</p> : null}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "创建管理员账号"}
            </Button>

            <div className="text-muted-foreground text-center text-sm">
              已经有管理员账号？
              <Link href="/admin/login" className="text-primary ml-1 font-medium hover:underline">
                去登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
