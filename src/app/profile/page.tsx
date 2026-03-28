"use client";

import { Eye, EyeOff, Paintbrush2Icon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileThemePicker, ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { TaskProgressBoard } from "@/components/profile/TaskProgressBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  getFrontendAccessState,
  getUserProfile,
  updateUserProfile,
} from "@/services/auth";
import { getTaskProgressByUserId, type TaskProgressItem } from "@/services/task";

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [isTasksRefreshing, setIsTasksRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [taskErrorMessage, setTaskErrorMessage] = useState<string | null>(null);
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
  const [tasks, setTasks] = useState<TaskProgressItem[]>([]);

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/profile");
      return;
    }

    if (!userToken) {
      setErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setTaskErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setIsLoading(false);
      setIsTasksLoading(false);
      return;
    }

    setToken(userToken);
    setErrorMessage(null);
    setTaskErrorMessage(null);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadProfileAndTasks = async () => {
      setIsLoading(true);
      setIsTasksLoading(true);
      setErrorMessage(null);
      setTaskErrorMessage(null);
      setSuccessMessage(null);

      try {
        const response = await getUserProfile(token);
        const nextUid = response.user.uid ?? "";

        setUid(nextUid);
        setScore(response.user.score);
        setUsername(response.user.username ?? "");
        setEmail(response.user.email ?? "");
        setHobby(response.user.extra_info?.hobby ?? "");

        if (!nextUid.trim()) {
          setTasks([]);
          setTaskErrorMessage("当前账号缺少有效的用户编号，暂时无法加载任务。");
          return;
        }

        try {
          const taskItems = await getTaskProgressByUserId(nextUid, { token });
          setTasks(taskItems);
          setTaskErrorMessage(null);
        } catch (error) {
          setTasks([]);
          setTaskErrorMessage(
            error instanceof Error ? error.message : "任务进度加载失败，请稍后重试。",
          );
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "用户资料加载失败。");
        setTasks([]);
        setTaskErrorMessage("用户资料尚未加载成功，暂时无法获取任务列表。");
      } finally {
        setIsLoading(false);
        setIsTasksLoading(false);
      }
    };

    void loadProfileAndTasks();
  }, [token]);

  const canSubmit = useMemo(
    () => Boolean(username.trim() && currentPassword.trim() && token && !isSaving),
    [username, currentPassword, token, isSaving],
  );

  const completedTaskCount = tasks.filter(
    (item) => item.requiredProgress <= 0 || item.completionProgress >= item.requiredProgress,
  ).length;

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
      setSuccessMessage("资料已更新。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "资料更新失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshTasks = async () => {
    if (!token || !uid.trim()) {
      return;
    }

    setIsTasksRefreshing(true);
    setTaskErrorMessage(null);

    try {
      const taskItems = await getTaskProgressByUserId(uid, { token });
      setTasks(taskItems);
    } catch (error) {
      setTaskErrorMessage(error instanceof Error ? error.message : "任务进度加载失败。");
    } finally {
      setIsTasksRefreshing(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="py-8">
        <ProfileThemeShell className="space-y-8">
          <header className="border-border/80 bg-card/80 grid gap-4 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div className="space-y-3">
              <div className="text-muted-foreground border-border/80 bg-background/80 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                <Paintbrush2Icon className="h-3.5 w-3.5" />
                个人中心
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">把个人中心调成你喜欢的样子</h1>
                <p className="text-muted-foreground max-w-3xl text-sm leading-6">
                  这里不仅能查看账号资料和任务完成情况，也可以切换个人中心主题。蓝白、粉白、黑白、黄底四种配色会一起应用到任务页、收藏页、文章管理等子页面。
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="border-border/70 bg-background/75 rounded-[1.4rem] border p-4 shadow-sm">
                <p className="text-muted-foreground text-xs tracking-[0.22em] uppercase">UID</p>
                <p className="mt-2 font-mono text-sm break-all">{uid || "--"}</p>
              </div>
              <div className="border-border/70 bg-background/75 rounded-[1.4rem] border p-4 shadow-sm">
                <p className="text-muted-foreground text-xs tracking-[0.22em] uppercase">
                  任务概览
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <SparklesIcon className="text-primary h-4 w-4" />
                  <p className="text-sm font-medium">
                    已完成 {completedTaskCount} / {tasks.length || 0}
                  </p>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">积分：{score}</p>
              </div>
            </div>
          </header>

          <ProfileThemePicker />

          <section className="border-border/80 bg-card/80 grid grid-cols-1 gap-3 rounded-[1.75rem] border p-4 shadow-sm backdrop-blur sm:grid-cols-2 xl:grid-cols-6">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/profile/likes">我的点赞</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/profile/favorites">我的收藏</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/profile/follow">关注管理</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/profile/articles">文章管理</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/profile/tasks">任务详情</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/profile/security">安全设置</Link>
            </Button>
          </section>

          <TaskProgressBoard
            tasks={tasks}
            isLoading={isTasksLoading}
            isRefreshing={isTasksRefreshing}
            errorMessage={taskErrorMessage}
            currentUserId={uid || null}
            title="我的任务"
            description="任务会按照当前登录账号自动同步展示，并区分未完成与已完成。"
            onRefresh={() => void handleRefreshTasks()}
          />

          {isLoading ? (
            <div className="border-border/80 bg-card/80 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur">
              <p className="text-muted-foreground">资料加载中...</p>
            </div>
          ) : (
            <section className="border-border/80 bg-card/80 space-y-5 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight">账号资料</h2>
                <p className="text-muted-foreground text-sm leading-6">
                  你可以在这里更新用户名、邮箱和兴趣信息。主题只影响页面展示，不会改动账号数据。
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="profile-uid">用户编号</Label>
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

                <div className="grid gap-2 md:col-span-2">
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
                  <p className="text-muted-foreground text-xs">
                    如果不填写新密码，保存时会继续使用当前密码。
                  </p>
                </div>
              </div>

              {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
              {successMessage ? <p className="text-primary text-sm">{successMessage}</p> : null}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button onClick={handleSave} disabled={!canSubmit}>
                  {isSaving ? "保存中..." : "保存资料"}
                </Button>
              </div>
            </section>
          )}
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
