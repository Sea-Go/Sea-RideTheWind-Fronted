"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthToken, getUserProfile, updateUserProfile } from "@/services/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [uid, setUid] = useState("");
  const [score, setScore] = useState(0);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [hobby, setHobby] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);

  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      router.replace("/login");
      return;
    }
    setToken(currentToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadProfile = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const response = await getUserProfile(token);
        setUid(response.user.uid);
        setScore(response.user.score);
        setUsername(response.user.username ?? "");
        setEmail(response.user.email ?? "");
        setHobby(response.user.extra_info?.hobby ?? "");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "用户信息加载失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [token]);

  const canSubmit = useMemo(
    () => !!username.trim() && !!currentPassword.trim() && !!token && !isSaving,
    [username, currentPassword, token, isSaving],
  );

  const handleSave = async () => {
    const normalizedCurrentPassword = currentPassword.trim();
    const normalizedNewPassword = newPassword.trim();

    if (!token || !username.trim() || !normalizedCurrentPassword) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        username: username.trim(),
        password: normalizedNewPassword || normalizedCurrentPassword,
        email: email.trim() || undefined,
        extra_info: hobby.trim() ? { hobby: hobby.trim() } : undefined,
      };
      const response = await updateUserProfile(token, payload);
      setUsername(response.user.username ?? username.trim());
      setEmail(response.user.email ?? email.trim());
      setHobby(response.user.extra_info?.hobby ?? hobby.trim());
      setCurrentPassword("");
      setNewPassword("");
      setCurrentPasswordVisible(false);
      setNewPasswordVisible(false);
      setSuccessMessage("资料已更新");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "资料更新失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">个人中心</h1>
          <p className="text-muted-foreground text-sm">查看并更新你的账户信息。</p>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Button asChild variant="outline">
            <Link href="/profile/likes">我的点赞</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/tasks">任务进度</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile/security">安全设置</Link>
          </Button>
        </section>

        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : (
          <div className="space-y-4 rounded-xl border p-6">
            <div className="grid gap-2">
              <Label htmlFor="profile-uid">用户 UID</Label>
              <Input id="profile-uid" value={uid} readOnly />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-score">积分</Label>
              <Input id="profile-score" value={String(score)} readOnly />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-username">用户名</Label>
              <Input
                id="profile-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                maxLength={32}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-email">邮箱</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-hobby">兴趣</Label>
              <Input
                id="profile-hobby"
                value={hobby}
                onChange={(event) => setHobby(event.target.value)}
                maxLength={64}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-current-password">当前密码（必填）</Label>
              <div className="relative">
                <Input
                  id="profile-current-password"
                  type={currentPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  maxLength={64}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => setCurrentPasswordVisible((visible) => !visible)}
                  aria-label={currentPasswordVisible ? "隐藏当前密码" : "显示当前密码"}
                >
                  {currentPasswordVisible ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-new-password">新密码（可选）</Label>
              <div className="relative">
                <Input
                  id="profile-new-password"
                  type={newPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  maxLength={64}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => setNewPasswordVisible((visible) => !visible)}
                  aria-label={newPasswordVisible ? "隐藏新密码" : "显示新密码"}
                >
                  {newPasswordVisible ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">不填写新密码时，将继续使用当前密码。</p>
            </div>

            {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
            {successMessage && <p className="text-primary text-sm">{successMessage}</p>}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleSave} disabled={!canSubmit}>
                {isSaving ? "保存中..." : "保存资料"}
              </Button>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
}
