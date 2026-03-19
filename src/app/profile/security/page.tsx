"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAppPrompt } from "@/components/common/AppPromptProvider";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { clearAuthToken, deleteCurrentUser, getAuthToken, logoutUser } from "@/services/auth";

export default function ProfileSecurityPage() {
  const router = useRouter();
  const { confirm } = useAppPrompt();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      router.replace("/login?next=/profile/security");
      return;
    }
    setToken(currentToken);
    setIsLoading(false);
  }, [router]);

  const handleLogout = async () => {
    if (!token) {
      clearAuthToken();
      router.push("/login");
      return;
    }

    setIsLoggingOut(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await logoutUser(token);
      clearAuthToken();
      router.push("/login");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "退出失败，请重试");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    const confirmed = await confirm({
      title: "确认注销账号",
      description: "该操作不可恢复，是否继续？",
      confirmText: "确认注销",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteCurrentUser(token);
      clearAuthToken();
      setSuccessMessage("账号已注销，即将返回登录页");
      setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "注销失败，请稍后再试");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">安全设置</h1>
          <p className="text-muted-foreground text-sm">管理账号退出与注销等高风险操作。</p>
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">返回个人中心</Link>
            </Button>
          </div>
        </header>

        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : (
          <section className="space-y-4 rounded-xl border p-6">
            <p className="text-muted-foreground text-sm">
              提示：注销账号后将无法恢复，请谨慎操作。
            </p>

            {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
            {successMessage && <p className="text-primary text-sm">{successMessage}</p>}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={isLoggingOut || isDeleting}
              >
                {isLoggingOut ? "退出中..." : "退出登录"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting || isLoggingOut}
              >
                {isDeleting ? "注销中..." : "注销账号"}
              </Button>
            </div>
          </section>
        )}
      </PageContainer>
    </Layout>
  );
}
