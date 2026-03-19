"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AdminProfile,
  clearAdminAuthToken,
  createAdmin,
  getAdminAuthToken,
  getAdminSelf,
  logoutAdmin,
  updateAdminSelf,
} from "@/services/admin";

export default function AdminProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState("");

  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminPosition, setNewAdminPosition] = useState("");

  useEffect(() => {
    const currentToken = getAdminAuthToken();
    if (!currentToken) {
      router.replace("/admin/login?next=/admin/profile");
      return;
    }
    setToken(currentToken);
  }, [router]);

  const loadSelf = async (authToken: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getAdminSelf(authToken);
      setAdmin(response.admin ?? null);
      setUsername(response.admin?.username ?? "");
      setEmail(response.admin?.email ?? "");
      setPassword("");
      setPosition(
        typeof response.admin?.extra_info?.position === "string"
          ? String(response.admin.extra_info.position)
          : "",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "管理员信息加载失败");
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadSelf(token);
  }, [token]);

  const handleUpdateSelf = async () => {
    if (!token || !username.trim()) {
      setErrorMessage("用户名不能为空");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminSelf(token, {
        username: username.trim(),
        email: email.trim() || undefined,
        password: password.trim() || undefined,
        extra_info: position.trim() ? { position: position.trim() } : undefined,
      });
      setPassword("");
      setSuccessMessage("管理员资料已更新");
      await loadSelf(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "管理员资料更新失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      setErrorMessage("新管理员账号和密码不能为空");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createAdmin({
        username: newAdminUsername.trim(),
        password: newAdminPassword.trim(),
        email: newAdminEmail.trim() || undefined,
        extra_info: newAdminPosition.trim() ? { position: newAdminPosition.trim() } : undefined,
      });
      setNewAdminUsername("");
      setNewAdminPassword("");
      setNewAdminEmail("");
      setNewAdminPosition("");
      setSuccessMessage("已创建新管理员");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建管理员失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    if (!token) {
      clearAdminAuthToken();
      router.push("/admin/login");
      return;
    }

    setIsLoggingOut(true);
    try {
      await logoutAdmin(token);
    } catch (error) {
      console.warn("admin logout request failed:", error);
    } finally {
      clearAdminAuthToken();
      setIsLoggingOut(false);
      router.push("/admin/login");
    }
  };

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">管理员资料</h1>
          <p className="text-muted-foreground text-sm">维护管理员资料并可创建新管理员账号。</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">返回管理首页</Link>
          </Button>
        </header>

        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : (
          <>
            {(errorMessage || successMessage) && (
              <div className="space-y-2">
                {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
                {successMessage && <p className="text-primary text-sm">{successMessage}</p>}
              </div>
            )}

            <section className="space-y-4 rounded-xl border p-6">
              <h2 className="text-xl font-semibold">管理员信息</h2>
              {admin && (
                <p className="text-muted-foreground text-xs">
                  UID：<span className="font-mono">{admin.uid}</span>
                </p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="admin-self-username">用户名</Label>
                <Input
                  id="admin-self-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-self-email">邮箱</Label>
                <Input
                  id="admin-self-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-self-password">新密码（可选）</Label>
                <Input
                  id="admin-self-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="不修改请留空"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-self-position">岗位（可选）</Label>
                <Input
                  id="admin-self-position"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleUpdateSelf}
                  disabled={isSaving || isCreating || isLoggingOut}
                >
                  {isSaving ? "保存中..." : "保存资料"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  disabled={isSaving || isCreating || isLoggingOut}
                >
                  {isLoggingOut ? "退出中..." : "退出登录"}
                </Button>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border p-6">
              <h2 className="text-xl font-semibold">创建管理员</h2>
              <div className="grid gap-2">
                <Label htmlFor="admin-create-username">账号</Label>
                <Input
                  id="admin-create-username"
                  value={newAdminUsername}
                  onChange={(event) => setNewAdminUsername(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-create-password">密码</Label>
                <Input
                  id="admin-create-password"
                  type="password"
                  value={newAdminPassword}
                  onChange={(event) => setNewAdminPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-create-email">邮箱（可选）</Label>
                <Input
                  id="admin-create-email"
                  type="email"
                  value={newAdminEmail}
                  onChange={(event) => setNewAdminEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-create-position">岗位（可选）</Label>
                <Input
                  id="admin-create-position"
                  value={newAdminPosition}
                  onChange={(event) => setNewAdminPosition(event.target.value)}
                />
              </div>
              <Button onClick={handleCreateAdmin} disabled={isCreating || isSaving || isLoggingOut}>
                {isCreating ? "创建中..." : "创建管理员"}
              </Button>
            </section>
          </>
        )}
      </PageContainer>
    </Layout>
  );
}
