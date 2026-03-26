"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppPrompt } from "@/components/common/AppPromptProvider";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type AdminUserProfile,
  banAdminUser,
  deleteAdminUser,
  getAdminAuthToken,
  getAdminUser,
  resetAdminUserPassword,
  unbanAdminUser,
  updateAdminUser,
} from "@/services/admin";

export default function AdminUserDetailPage() {
  const router = useRouter();
  const { confirm } = useAppPrompt();
  const params = useParams<{ uid: string }>();
  const uid = useMemo(() => decodeURIComponent(params.uid), [params.uid]);

  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUserProfile | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hobby, setHobby] = useState("");

  useEffect(() => {
    const currentToken = getAdminAuthToken();
    if (!currentToken) {
      router.replace(`/admin/login?next=/admin/users/${encodeURIComponent(uid)}`);
      return;
    }
    setToken(currentToken);
  }, [router, uid]);

  const loadUser = useCallback(
    async (authToken: string) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getAdminUser(authToken, { uid });
        if (!response.found || !response.user) {
          throw new Error("未找到用户");
        }

        setUser(response.user);
        setUsername(response.user.username ?? "");
        setEmail(response.user.email ?? "");
        setPassword("");
        setHobby(
          typeof response.user.extra_info?.hobby === "string" ? response.user.extra_info.hobby : "",
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "用户详情加载失败");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    },
    [uid],
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadUser(token);
  }, [loadUser, token]);

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await action();
      setSuccessMessage(successText);
      if (token) {
        await loadUser(token);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!token || !username.trim()) {
      setErrorMessage("用户名不能为空");
      return;
    }

    await runAction(
      async () =>
        updateAdminUser(token, {
          uid,
          username: username.trim(),
          email: email.trim() || undefined,
          password: password.trim() || undefined,
          extra_info: hobby.trim() ? { hobby: hobby.trim() } : undefined,
        }),
      "用户信息已更新",
    );
    setPassword("");
  };

  const handleResetPassword = async () => {
    if (!token) {
      return;
    }
    const confirmed = await confirm({
      title: "确认重置密码",
      description: "确认重置该用户密码？",
      confirmText: "确认重置",
    });
    if (!confirmed) {
      return;
    }

    await runAction(
      async () =>
        resetAdminUserPassword(token, {
          uid,
        }),
      "用户密码重置成功",
    );
  };

  const handleBanToggle = async () => {
    if (!token || !user) {
      return;
    }

    const isBanned = user.status === 1;
    const confirmed = await confirm({
      title: isBanned ? "确认解封用户" : "确认封禁用户",
      description: isBanned ? "确认解封该用户？" : "确认封禁该用户？",
      confirmText: isBanned ? "确认解封" : "确认封禁",
      destructive: !isBanned,
    });
    if (!confirmed) {
      return;
    }

    await runAction(
      async () =>
        isBanned
          ? unbanAdminUser(token, {
              uid,
            })
          : banAdminUser(token, {
              uid,
            }),
      isBanned ? "用户已解封" : "用户已封禁",
    );
  };

  const handleDelete = async () => {
    if (!token) {
      return;
    }

    const confirmed = await confirm({
      title: "确认删除用户",
      description: "该操作不可恢复，确认删除该用户？",
      confirmText: "确认删除",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteAdminUser(token, { uid });
      router.push("/admin/users");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除失败");
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">用户详情</h1>
          <p className="text-muted-foreground text-sm">
            执行封禁、解封、重置密码、删除等管理操作。
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/users">返回用户列表</Link>
          </Button>
        </header>

        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : (
          <section className="space-y-4 rounded-xl border p-6">
            {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
            {successMessage && <p className="text-primary text-sm">{successMessage}</p>}

            {!user && !errorMessage && <p className="text-muted-foreground text-sm">用户不存在</p>}

            {user && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="admin-user-uid">用户编号</Label>
                  <Input id="admin-user-uid" value={uid} readOnly />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-user-username">用户名</Label>
                  <Input
                    id="admin-user-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-user-email">邮箱</Label>
                  <Input
                    id="admin-user-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-user-password">新密码（可选）</Label>
                  <Input
                    id="admin-user-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="不修改请留空"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-user-hobby">爱好（可选）</Label>
                  <Input
                    id="admin-user-hobby"
                    value={hobby}
                    onChange={(event) => setHobby(event.target.value)}
                  />
                </div>
                <p className="text-sm">当前状态：{user.status === 1 ? "已封禁" : "正常"}</p>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleUpdate} disabled={isSubmitting}>
                    更新用户
                  </Button>
                  <Button variant="secondary" onClick={handleResetPassword} disabled={isSubmitting}>
                    重置密码
                  </Button>
                  <Button variant="outline" onClick={handleBanToggle} disabled={isSubmitting}>
                    {user.status === 1 ? "解封用户" : "封禁用户"}
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                    删除用户
                  </Button>
                </div>
              </>
            )}
          </section>
        )}
      </PageContainer>
    </Layout>
  );
}
