"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRightIcon,
  BookmarkIcon,
  Eye,
  EyeOff,
  HeartIcon,
  Paintbrush2Icon,
  Settings2Icon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { TaskProgressBoard } from "@/components/profile/TaskProgressBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  getFrontendAccessState,
  getUserProfile,
  updateUserProfile,
} from "@/services/auth";
import { getTaskProgressByUserId, type TaskProgressItem } from "@/services/task";

const QuickActionCard = ({
  href,
  title,
  description,
  icon: Icon,
  badge,
  featured = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  featured?: boolean;
}) => (
  <Link
    href={href}
    className={cn(
      "group border-border/80 bg-card/82 relative overflow-hidden rounded-[1.75rem] border shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
      featured ? "min-h-[220px] p-6" : "min-h-[148px] p-5",
    )}
  >
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 opacity-90",
        featured ? "h-28" : "h-20",
      )}
      style={{
        backgroundImage: featured
          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(255, 255, 255, 0.03))"
          : "linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(255, 255, 255, 0.02))",
      }}
    />
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl",
        featured ? "-top-10 right-0 h-36 w-36" : "-top-8 right-0 h-28 w-28",
      )}
      style={{
        backgroundColor: featured ? "rgba(59, 130, 246, 0.18)" : "rgba(59, 130, 246, 0.14)",
      }}
    />

    <div className="relative flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <span className="text-muted-foreground border-border/80 bg-background/80 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.18em] uppercase">
            {badge}
          </span>
          <span
            className={cn(
              "bg-primary/12 text-primary inline-flex items-center justify-center rounded-[1.4rem] shadow-sm ring-1 ring-white/60",
              featured ? "h-16 w-16" : "h-12 w-12",
            )}
          >
            <Icon className={featured ? "h-8 w-8" : "h-6 w-6"} />
          </span>
        </div>
        <span className="text-muted-foreground group-hover:text-primary mt-1 transition-colors">
          <ArrowRightIcon className={featured ? "h-6 w-6" : "h-5 w-5"} />
        </span>
      </div>

      <div className={cn("mt-auto space-y-2", featured ? "pt-10" : "pt-6")}>
        <h2 className={cn("font-semibold tracking-tight", featured ? "text-2xl" : "text-lg")}>
          {title}
        </h2>
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      </div>
    </div>
  </Link>
);

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
                <h1 className="text-3xl font-bold tracking-tight">把常用内容放在更顺手的位置</h1>
                <p className="text-muted-foreground max-w-3xl text-sm leading-6">
                  这里保留你最常点开的入口，并把视觉重点集中到点赞和关注管理。主题配色已经移到设置页统一管理，个人中心会更轻一些，也更聚焦你每天要看的内容。
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

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_320px]">
            <QuickActionCard
              href="/profile/likes"
              title="我的点赞"
              description="集中查看你点过赞的内容，快速回到最近认可过的文章和互动。"
              icon={HeartIcon}
              badge="重点入口"
              featured
            />
            <QuickActionCard
              href="/profile/follow"
              title="关注管理"
              description="统一整理你关注的人和内容关系，方便继续追踪熟悉的作者与主题。"
              icon={UsersIcon}
              badge="重点入口"
              featured
            />

            <div className="grid gap-4">
              <QuickActionCard
                href="/profile/favorites"
                title="我的收藏"
                description="保留你已经收藏的内容，随时回看。"
                icon={BookmarkIcon}
                badge="常用"
              />
              <QuickActionCard
                href="/settings"
                title="设置"
                description="主题配色和账户偏好已经挪到这里统一管理。"
                icon={Settings2Icon}
                badge="已迁移"
              />
            </div>
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
                  你可以在这里更新用户名、邮箱和兴趣信息。页面主题和安全相关操作已经移到设置页，账号资料区会更专注于基础信息编辑。
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

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={handleSave} disabled={!canSubmit}>
                  {isSaving ? "保存中..." : "保存资料"}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/settings">前往设置</Link>
                </Button>
              </div>
            </section>
          )}
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
