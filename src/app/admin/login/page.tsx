"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminAuthToken, loginAdmin, saveAdminAuthToken } from "@/services/admin";

const getSafeNext = (next: string | null): string => {
  if (!next) {
    return "/admin";
  }
  if (next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return "/admin";
};

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (getAdminAuthToken()) {
      router.replace("/admin");
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setErrorMessage("请输入管理员账号和密码");
      return;
    }

    setIsLoading(true);
    try {
      const response = await loginAdmin({
        username: normalizedUsername,
        password,
      });

      saveAdminAuthToken(response.token);
      router.push(getSafeNext(searchParams.get("next")));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败，请稍后再试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">管理员登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="admin-username">账号</Label>
              <Input
                id="admin-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="请输入管理员账号"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-password">密码</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="请输入密码"
              />
            </div>

            {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "登录中..." : "进入管理后台"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              还没有管理员账号？
              <Link href="/admin/register" className="text-primary ml-1 font-medium hover:underline">
                去注册
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}
