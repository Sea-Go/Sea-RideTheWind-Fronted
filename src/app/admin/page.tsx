"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { buildLoginPath } from "@/lib/auth-entry";
import {
  type AdminProfile,
  clearAdminAuthToken,
  getAdminAuthToken,
  getAdminSelf,
  logoutAdmin,
} from "@/services/admin";
import { clearAuthToken, getAuthToken, logoutUser } from "@/services/auth";

export default function AdminHomePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  useEffect(() => {
    const currentToken = getAdminAuthToken();
    if (!currentToken) {
      router.replace(buildLoginPath({ role: "admin", next: "/admin" }));
      return;
    }
    setToken(currentToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadSelf = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await getAdminSelf(token);
        setAdmin(response.admin ?? null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "管理员信息加载失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSelf();
  }, [token]);

  const handleLogout = async () => {
    const userToken = getAuthToken();

    if (!token) {
      clearAdminAuthToken();
      clearAuthToken();
      router.push(buildLoginPath({ role: "admin" }));
      return;
    }

    setIsLoggingOut(true);
    try {
      await Promise.allSettled([
        logoutAdmin(token),
        userToken ? logoutUser(userToken) : Promise.resolve({ success: true }),
      ]);
    } catch (error) {
      console.warn("admin logout request failed:", error);
    } finally {
      clearAdminAuthToken();
      clearAuthToken();
      setIsLoggingOut(false);
      router.push(buildLoginPath({ role: "admin" }));
    }
  };

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">管理后台</h1>
          <p className="text-muted-foreground text-sm">执行用户管理与管理员资料维护。</p>
        </header>

        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : (
          <>
            {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}

            {admin && (
              <section className="space-y-2 rounded-xl border p-6">
                <h2 className="text-xl font-semibold">管理员信息</h2>
                <p className="text-sm">
                  用户编号：<span className="font-mono">{admin.uid}</span>
                </p>
                <p className="text-sm">用户名：{admin.username}</p>
                <p className="text-sm">邮箱：{admin.email || "--"}</p>
              </section>
            )}

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Button asChild variant="outline">
                <Link href="/admin/users">用户管理</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/profile">管理员资料</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/register">管理员账号</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/messages">消息中心</Link>
              </Button>
              <Button variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? "退出中..." : "退出登录"}
              </Button>
            </section>
          </>
        )}
      </PageContainer>
    </Layout>
  );
}
