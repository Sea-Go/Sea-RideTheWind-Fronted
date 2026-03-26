"use client";

import {
  CheckCircle2Icon,
  ClipboardListIcon,
  Clock3Icon,
  RefreshCcwIcon,
  TargetIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TaskProgressItem } from "@/services/task";

interface TaskProgressBoardProps {
  tasks: TaskProgressItem[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  errorMessage?: string | null;
  currentUserId?: string | null;
  title?: string;
  description?: string;
  onRefresh?: (() => void) | null;
}

type TaskFilter = "pending" | "completed";

const isTaskCompleted = (item: TaskProgressItem): boolean =>
  item.requiredProgress <= 0 || item.completionProgress >= item.requiredProgress;

const progressPercent = (item: TaskProgressItem): number => {
  if (item.requiredProgress <= 0) {
    return 100;
  }

  return Math.min(100, Math.floor((item.completionProgress / item.requiredProgress) * 100));
};

const TaskSummaryCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) => (
  <Card className="border-border/80 bg-card/85 py-0 shadow-sm backdrop-blur">
    <CardContent className="flex items-center justify-between p-5">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </div>
      <div className="bg-primary/12 text-primary rounded-2xl p-3">{icon}</div>
    </CardContent>
  </Card>
);

const TaskSection = ({
  title,
  description,
  emptyMessage,
  tasks,
  completed,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  tasks: TaskProgressItem[];
  completed: boolean;
}) => (
  <Card className="border-border/80 bg-card/85 shadow-sm backdrop-blur">
    <CardHeader className="space-y-2">
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      {tasks.length === 0 ? (
        <div className="text-muted-foreground border-border bg-muted/45 rounded-2xl border border-dashed px-4 py-6 text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((item) => (
            <div
              key={item.taskId}
              className="border-border/70 bg-background/85 space-y-3 rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        completed
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {completed ? "已完成" : "未完成"}
                    </span>
                    <span className="text-muted-foreground text-xs">任务 #{item.taskId}</span>
                  </div>
                  <p className="text-lg font-semibold">{item.name}</p>
                  {item.desc ? (
                    <p className="text-muted-foreground text-sm leading-6">{item.desc}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
                    Progress
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-medium",
                      completed ? "text-primary" : "text-secondary-foreground",
                    )}
                  >
                    {item.completionProgress} / {item.requiredProgress}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full transition-all",
                      completed ? "bg-primary" : "bg-secondary-foreground",
                    )}
                    style={{ width: `${progressPercent(item)}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">当前完成度 {progressPercent(item)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export const TaskProgressBoard = ({
  tasks,
  isLoading = false,
  isRefreshing = false,
  errorMessage = null,
  currentUserId = null,
  title = "任务进度",
  description = "系统会根据当前登录账号自动同步任务完成情况。",
  onRefresh = null,
}: TaskProgressBoardProps) => {
  const [activeFilter, setActiveFilter] = useState<TaskFilter>("pending");

  const pendingTasks = tasks.filter((item) => !isTaskCompleted(item));
  const completedTasks = tasks.filter((item) => isTaskCompleted(item));
  const isShowingCompleted = activeFilter === "completed";
  const visibleTasks = isShowingCompleted ? completedTasks : pendingTasks;
  const sectionTitle = isShowingCompleted ? "已完成任务" : "未完成任务";
  const sectionDescription = isShowingCompleted
    ? "这里展示已经达成目标的任务记录。"
    : "这里展示当前还可以继续推进的任务。";
  const emptyMessage = isShowingCompleted ? "当前还没有已完成任务。" : "当前没有未完成任务。";

  return (
    <section className="space-y-6">
      <div className="border-border/80 bg-card/85 flex flex-col gap-3 rounded-[1.75rem] border p-6 shadow-sm backdrop-blur lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-muted-foreground border-border/80 bg-background/80 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <ClipboardListIcon className="h-3.5 w-3.5" />
            任务系统
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="text-muted-foreground text-sm leading-6">{description}</p>
            {currentUserId ? (
              <p className="text-muted-foreground text-xs">当前任务用户编号：{currentUserId}</p>
            ) : null}
          </div>
        </div>
        {onRefresh ? (
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isLoading || isRefreshing || !currentUserId}
          >
            <RefreshCcwIcon className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isRefreshing ? "刷新中..." : "刷新任务"}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TaskSummaryCard
          label="任务总数"
          value={tasks.length}
          icon={<ClipboardListIcon className="h-5 w-5" />}
        />
        <TaskSummaryCard
          label="未完成"
          value={pendingTasks.length}
          icon={<Clock3Icon className="h-5 w-5" />}
        />
        <TaskSummaryCard
          label="已完成"
          value={completedTasks.length}
          icon={<CheckCircle2Icon className="h-5 w-5" />}
        />
      </div>

      {errorMessage ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-2xl border px-4 py-3 text-sm">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          <Card className="border-border/80 bg-card/85 shadow-sm backdrop-blur">
            <CardHeader className="space-y-2">
              <div className="bg-muted h-5 w-32 animate-pulse rounded" />
              <div className="bg-muted h-4 w-64 animate-pulse rounded" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 2 }).map((_, innerIndex) => (
                <div
                  key={`task-skeleton-item-${innerIndex}`}
                  className="border-border/70 bg-background/70 space-y-3 rounded-2xl border p-4"
                >
                  <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                  <div className="bg-muted h-6 w-48 animate-pulse rounded" />
                  <div className="bg-muted h-4 w-full animate-pulse rounded" />
                  <div className="bg-muted h-2 w-full animate-pulse rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-border/80 bg-background/85 inline-flex flex-wrap items-center gap-2 rounded-full border p-1 shadow-sm backdrop-blur">
            <Button
              type="button"
              size="sm"
              variant={activeFilter === "pending" ? "default" : "ghost"}
              className={cn(
                "rounded-full px-4",
                activeFilter === "pending"
                  ? "shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveFilter("pending")}
            >
              未完成
              {pendingTasks.length > 0 ? ` (${pendingTasks.length})` : ""}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeFilter === "completed" ? "default" : "ghost"}
              className={cn(
                "rounded-full px-4",
                activeFilter === "completed"
                  ? "shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveFilter("completed")}
            >
              已完成
              {completedTasks.length > 0 ? ` (${completedTasks.length})` : ""}
            </Button>
          </div>

          <TaskSection
            title={sectionTitle}
            description={sectionDescription}
            emptyMessage={emptyMessage}
            tasks={visibleTasks}
            completed={isShowingCompleted}
          />
        </div>
      )}

      {!isLoading && tasks.length === 0 && !errorMessage ? (
        <Card className="border-border/80 bg-card/85 shadow-sm backdrop-blur">
          <CardContent className="text-muted-foreground flex items-center gap-3 p-6 text-sm">
            <TargetIcon className="text-primary/75 h-5 w-5" />
            当前还没有可展示的任务数据，完成互动后这里会自动更新。
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
};
