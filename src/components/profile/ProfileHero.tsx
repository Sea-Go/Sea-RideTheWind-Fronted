import { ClipboardListIcon, Edit3Icon, SparklesIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ProfileAvatar } from "./ProfileAvatar";

const formatPercent = (completedTaskCount: number, totalTaskCount: number): number =>
  totalTaskCount > 0 ? Math.min(100, Math.round((completedTaskCount / totalTaskCount) * 100)) : 0;

const ProfileStat = ({ label, value }: { label: string; value: string }) => (
  <div className="app-stat-tile rounded-[1.35rem] px-4 py-3">
    <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">{label}</p>
    <p className="mt-1 text-sm font-semibold break-all">{value}</p>
  </div>
);

export const ProfileHero = ({
  username,
  uid,
  score,
  avatarUrl,
  completedTaskCount,
  totalTaskCount,
  isLoading = false,
  className,
}: {
  username: string;
  uid: string;
  score: number;
  avatarUrl?: string | null;
  completedTaskCount: number;
  totalTaskCount: number;
  isLoading?: boolean;
  className?: string;
}) => {
  const progressPercent = formatPercent(completedTaskCount, totalTaskCount);
  const displayName = username.trim() || "识海用户";

  return (
    <section
      className={cn(
        "app-hero-surface relative overflow-hidden rounded-[2rem] p-5 md:p-6 lg:p-7",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_18%_18%,color-mix(in_oklab,var(--app-surface-elevated)_70%,transparent),transparent_18rem),linear-gradient(135deg,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)]"
      />
      <div
        aria-hidden
        className="bg-primary/15 pointer-events-none absolute -top-14 right-8 h-44 w-44 rounded-full blur-3xl"
      />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ProfileAvatar avatarUrl={avatarUrl} uid={uid} username={displayName} size="xl" />

            <div className="min-w-0 space-y-3">
              <span className="app-pill text-muted-foreground inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                <SparklesIcon className="h-3.5 w-3.5" />
                个人中心
              </span>
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{displayName}</h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/profile/edit">
                <Edit3Icon className="h-4 w-4" />
                编辑资料
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile/follow">
                <UsersIcon className="h-4 w-4" />
                关注管理
              </Link>
            </Button>
            <Button asChild>
              <Link href="/profile/tasks">
                <ClipboardListIcon className="h-4 w-4" />
                查看任务
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <ProfileStat label="UID" value={isLoading ? "加载中..." : uid || "--"} />
          <ProfileStat label="积分" value={isLoading ? "--" : String(score)} />
          <ProfileStat
            label="任务"
            value={isLoading ? "--" : `已完成 ${completedTaskCount} / ${totalTaskCount || 0}`}
          />
        </div>

        <div className="app-surface-soft rounded-[1.35rem] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">今日任务进度</p>
            <p className="text-primary text-sm font-semibold">{progressPercent}%</p>
          </div>
          <div className="bg-muted h-2.5 overflow-hidden rounded-full">
            <div
              className="from-primary h-full rounded-full bg-gradient-to-r to-sky-300 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
