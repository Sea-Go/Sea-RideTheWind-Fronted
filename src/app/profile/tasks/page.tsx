"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthToken, getUserProfile } from "@/services/auth";
import { getTaskProgress, type TaskProgressItem } from "@/services/task";

const DEFAULT_TASK_QUERY_ID = 2021020;

const progressPercent = (item: TaskProgressItem): number => {
  if (!item.requiredProgress || item.requiredProgress <= 0) {
    return 0;
  }

  return Math.min(100, Math.floor((item.completionProgress / item.requiredProgress) * 100));
};

export default function ProfileTasksPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [queryId, setQueryId] = useState<number>(DEFAULT_TASK_QUERY_ID);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskProgressItem[]>([]);

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

    const bootstrapQueryId = async () => {
      try {
        const profile = await getUserProfile(token);
        const parsedUid = Number.parseInt(profile.user.uid, 10);
        if (Number.isFinite(parsedUid) && parsedUid > 0) {
          setQueryId(parsedUid);
        }
      } catch (error) {
        console.warn("Failed to bootstrap task query id from uid:", error);
      }
    };

    void bootstrapQueryId();
  }, [token]);

  const loadTasks = async (refresh = false) => {
    if (!token) {
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const response = await getTaskProgress(
        { id: queryId },
        {
          token,
        },
      );
      setTasks(Array.isArray(response.tasks) ? response.tasks : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "任务进度加载失败");
      setTasks([]);
    } finally {
      if (refresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadTasks(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, queryId]);

  const inProgressTasks = useMemo(
    () => tasks.filter((item) => item.completionProgress < item.requiredProgress),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((item) => item.completionProgress >= item.requiredProgress),
    [tasks],
  );

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">任务进度</h1>
          <p className="text-muted-foreground text-sm">查看当前任务完成情况与进度。</p>
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">返回个人中心</Link>
            </Button>
          </div>
        </header>

        <section className="space-y-3 rounded-xl border p-6">
          <div className="grid gap-2">
            <Label htmlFor="task-query-id">任务查询 ID</Label>
            <Input
              id="task-query-id"
              type="number"
              value={queryId}
              onChange={(event) => setQueryId(Number.parseInt(event.target.value || "0", 10))}
            />
          </div>
          <Button variant="secondary" onClick={() => void loadTasks(true)} disabled={isRefreshing}>
            {isRefreshing ? "刷新中..." : "刷新任务进度"}
          </Button>
          {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
        </section>

        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : (
          <>
            <section className="space-y-4 rounded-xl border p-6">
              <h2 className="text-xl font-semibold">进行中</h2>
              {inProgressTasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">暂无进行中的任务</p>
              ) : (
                <div className="space-y-3">
                  {inProgressTasks.map((item) => (
                    <div key={item.taskId} className="space-y-2 rounded-lg border p-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-muted-foreground text-sm">{item.desc}</p>
                      <p className="text-sm">
                        {item.completionProgress} / {item.requiredProgress}
                      </p>
                      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${progressPercent(item)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-xl border p-6">
              <h2 className="text-xl font-semibold">已完成</h2>
              {completedTasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">暂无已完成任务</p>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((item) => (
                    <div key={item.taskId} className="space-y-2 rounded-lg border p-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-muted-foreground text-sm">{item.desc}</p>
                      <p className="text-primary text-sm font-medium">
                        已完成 {item.completionProgress} / {item.requiredProgress}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </PageContainer>
    </Layout>
  );
}
