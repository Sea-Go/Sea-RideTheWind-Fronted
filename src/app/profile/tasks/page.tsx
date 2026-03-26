"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TaskProgressBoard } from "@/components/profile/TaskProgressBoard";
import { ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { getAuthToken, getUserProfile } from "@/services/auth";
import { getTaskProgressByUserId, type TaskProgressItem } from "@/services/task";

export default function ProfileTasksPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [tasks, setTasks] = useState<TaskProgressItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      router.replace("/login?next=/profile/tasks");
      return;
    }
    setToken(currentToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadTasks = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const profile = await getUserProfile(token);
        const nextUserId = profile.user.uid ?? "";
        setUserId(nextUserId);

        const taskItems = await getTaskProgressByUserId(nextUserId, { token });
        setTasks(taskItems);
      } catch (error) {
        setTasks([]);
        setErrorMessage(error instanceof Error ? error.message : "任务进度加载失败。");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTasks();
  }, [token]);

  const handleRefresh = async () => {
    if (!token || !userId.trim()) {
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const taskItems = await getTaskProgressByUserId(userId, { token });
      setTasks(taskItems);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "任务进度加载失败。");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="py-8">
        <ProfileThemeShell className="space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">任务详情</h1>
              <p className="text-muted-foreground text-sm">
                这里会完整展示当前登录账号的任务进度，并细分为未完成和已完成。
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/profile">返回个人中心</Link>
            </Button>
          </header>

          <TaskProgressBoard
            tasks={tasks}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            errorMessage={errorMessage}
            currentUserId={userId || null}
            title="全部任务"
            description="任务数据直接来自后端任务系统，刷新后即可看到最新完成情况。"
            onRefresh={() => void handleRefresh()}
          />
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
