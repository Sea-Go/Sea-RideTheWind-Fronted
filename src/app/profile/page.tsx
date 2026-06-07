"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileTaskDigest } from "@/components/profile/ProfileTaskDigest";
import { ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  getFrontendAccessState,
  getProfileAvatarUrl,
  getUserProfile,
} from "@/services/auth";
import { getTaskProgressByUserId, type TaskProgressItem } from "@/services/task";

const isTaskCompleted = (item: TaskProgressItem): boolean =>
  item.requiredProgress <= 0 || item.completionProgress >= item.requiredProgress;

export default function ProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [isTasksRefreshing, setIsTasksRefreshing] = useState(false);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [taskErrorMessage, setTaskErrorMessage] = useState<string | null>(null);

  const [uid, setUid] = useState("");
  const [score, setScore] = useState(0);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tasks, setTasks] = useState<TaskProgressItem[]>([]);

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/profile");
      return;
    }

    if (!userToken) {
      setProfileErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setTaskErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setIsProfileLoading(false);
      setIsTasksLoading(false);
      return;
    }

    setToken(userToken);
    setProfileErrorMessage(null);
    setTaskErrorMessage(null);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadProfileAndTasks = async () => {
      setIsProfileLoading(true);
      setIsTasksLoading(true);
      setProfileErrorMessage(null);
      setTaskErrorMessage(null);

      try {
        const response = await getUserProfile(token);
        const nextUid = response.user.uid ?? "";

        setUid(nextUid);
        setScore(response.user.score);
        setUsername(response.user.username ?? "");
        setAvatarUrl(getProfileAvatarUrl(response.user));

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
        setProfileErrorMessage(error instanceof Error ? error.message : "用户资料加载失败。");
        setTasks([]);
        setTaskErrorMessage("用户资料尚未加载成功，暂时无法获取任务列表。");
      } finally {
        setIsProfileLoading(false);
        setIsTasksLoading(false);
      }
    };

    void loadProfileAndTasks();
  }, [token]);

  const completedTaskCount = tasks.filter(isTaskCompleted).length;

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
        <ProfileThemeShell className="space-y-6">
          {profileErrorMessage ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-2xl border px-4 py-3 text-sm">
              {profileErrorMessage}
            </div>
          ) : null}

          <ProfileHero
            username={username}
            uid={uid}
            score={score}
            avatarUrl={avatarUrl}
            completedTaskCount={completedTaskCount}
            totalTaskCount={tasks.length}
            isLoading={isProfileLoading}
          />

          <ProfileTaskDigest
            tasks={tasks}
            isLoading={isTasksLoading}
            isRefreshing={isTasksRefreshing}
            errorMessage={taskErrorMessage}
            currentUserId={uid || null}
            onRefresh={() => void handleRefreshTasks()}
          />
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
