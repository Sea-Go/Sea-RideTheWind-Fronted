import { CheckCircle2Icon, Clock3Icon, RefreshCcwIcon, TargetIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskProgressItem } from "@/services/task";

const isTaskCompleted = (item: TaskProgressItem): boolean =>
  item.requiredProgress <= 0 || item.completionProgress >= item.requiredProgress;

const getProgressPercent = (item: TaskProgressItem): number =>
  item.requiredProgress <= 0
    ? 100
    : Math.min(100, Math.floor((item.completionProgress / item.requiredProgress) * 100));

export const ProfileTaskDigest = ({
  tasks,
  isLoading = false,
  isRefreshing = false,
  errorMessage = null,
  currentUserId = null,
  onRefresh = null,
  className,
}: {
  tasks: TaskProgressItem[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  errorMessage?: string | null;
  currentUserId?: string | null;
  onRefresh?: (() => void) | null;
  className?: string;
}) => {
  const pendingTasks = tasks.filter((item) => !isTaskCompleted(item));
  const completedTasks = tasks.filter(isTaskCompleted);
  const progressPercent =
    tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const visibleTasks = pendingTasks.slice(0, 3);

  return (
    <section
      className={cn(
        "border-border/80 bg-card/82 relative overflow-hidden rounded-[1.85rem] border p-5 shadow-sm backdrop-blur md:p-6",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-8 h-40 w-40 rounded-full bg-sky-300/20 blur-3xl"
      />

      <div className="relative space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <span className="text-muted-foreground border-border/80 bg-background/80 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <TargetIcon className="h-3.5 w-3.5" />
              今日任务
            </span>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">把今天的目标收束一下</h2>
              {tasks.length > 0 ? (
                <p className="text-muted-foreground text-sm">
                  已完成 {completedTasks.length} 个，还有 {pendingTasks.length} 个待推进。
                </p>
              ) : null}
            </div>
          </div>

          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading || isRefreshing || !currentUserId}
            >
              <RefreshCcwIcon className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {isRefreshing ? "刷新中..." : "刷新"}
            </Button>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-2xl border px-4 py-3 text-sm">
            {errorMessage}
          </div>
        ) : null}

        <div className="border-border/70 bg-background/75 rounded-[1.35rem] border p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">完成率</p>
            <p className="text-primary text-sm font-semibold">{progressPercent}%</p>
          </div>
          <div className="bg-muted h-2.5 overflow-hidden rounded-full">
            <div
              className="from-primary h-full rounded-full bg-gradient-to-r to-sky-300 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`profile-task-skeleton-${index}`}
                className="border-border/70 bg-background/70 space-y-3 rounded-2xl border p-4"
              >
                <div className="bg-muted h-5 w-36 animate-pulse rounded" />
                <div className="bg-muted h-4 w-full animate-pulse rounded" />
                <div className="bg-muted h-2 w-full animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : visibleTasks.length > 0 ? (
          <div className="space-y-3">
            {visibleTasks.map((item) => (
              <div
                key={item.taskId}
                className="border-border/70 bg-background/75 rounded-2xl border p-4 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold tracking-tight">{item.name}</p>
                    {item.desc ? (
                      <p className="text-muted-foreground line-clamp-2 text-sm leading-6">
                        {item.desc}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
                    <Clock3Icon className="h-3.5 w-3.5" />
                    {item.completionProgress} / {item.requiredProgress}
                  </span>
                </div>
                <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${getProgressPercent(item)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-border/70 bg-background/75 text-muted-foreground flex items-center gap-3 rounded-2xl border border-dashed p-4 text-sm">
            <CheckCircle2Icon className="text-primary h-5 w-5" />
            {tasks.length > 0 ? "今日任务已完成" : "暂无任务"}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline">
            <Link href="/profile/tasks">查看全部任务</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
