"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  getFrontendAccessState,
  getUserProfile,
} from "@/services/auth";
import {
  blockUser,
  followUser,
  getBlockList,
  getFollowerList,
  getFollowList,
  getRecommendations,
  unblockUser,
  unfollowUser,
  type RecommendUser,
} from "@/services/follow";

const PAGE_SIZE = 20;

const formatUserId = (userId: number): string => `${userId}`;

export default function ProfileFollowPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [followIds, setFollowIds] = useState<number[]>([]);
  const [followerIds, setFollowerIds] = useState<number[]>([]);
  const [blockIds, setBlockIds] = useState<number[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendUser[]>([]);

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/profile/follow");
      return;
    }

    if (!userToken) {
      setErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setIsLoading(false);
      return;
    }

    setToken(userToken);
    setErrorMessage(null);
  }, [router]);

  const loadData = async (currentToken: string): Promise<void> => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const profile = await getUserProfile(currentToken);
      const userId = typeof profile.user.uid === "string" ? profile.user.uid.trim() : "";
      if (!userId) {
        throw new Error("无法解析当前用户编号");
      }

      const [followResult, followerResult, blockResult, recommendResult] = await Promise.all([
        getFollowList(currentToken, { user_id: userId, offset: 0, limit: PAGE_SIZE }),
        getFollowerList(currentToken, { user_id: userId, offset: 0, limit: PAGE_SIZE }),
        getBlockList(currentToken, { user_id: userId, offset: 0, limit: PAGE_SIZE }),
        getRecommendations(currentToken, { user_id: userId, offset: 0, limit: PAGE_SIZE }),
      ]);

      setCurrentUserId(userId);
      setFollowIds(Array.isArray(followResult.user_ids) ? followResult.user_ids : []);
      setFollowerIds(Array.isArray(followerResult.user_ids) ? followerResult.user_ids : []);
      setBlockIds(Array.isArray(blockResult.user_ids) ? blockResult.user_ids : []);
      setRecommendations(Array.isArray(recommendResult.users) ? recommendResult.users : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "关注数据加载失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadData(token);
  }, [token]);

  const normalizedTargetId = useMemo(() => targetUserId.trim(), [targetUserId]);

  const handleRelationAction = async (
    action: "follow" | "unfollow" | "block" | "unblock",
  ): Promise<void> => {
    if (!token || !normalizedTargetId) {
      setActionMessage("请先输入目标用户编号");
      return;
    }

    setIsActionLoading(true);
    setActionMessage(null);
    setErrorMessage(null);

    try {
      if (action === "follow") {
        await followUser(token, { target_id: normalizedTargetId });
        setActionMessage("关注成功");
      } else if (action === "unfollow") {
        await unfollowUser(token, { target_id: normalizedTargetId });
        setActionMessage("已取消关注");
      } else if (action === "block") {
        await blockUser(token, { target_id: normalizedTargetId });
        setActionMessage("拉黑成功");
      } else {
        await unblockUser(token, { target_id: normalizedTargetId });
        setActionMessage("已取消拉黑");
      }

      await loadData(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "关系更新失败");
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderUserIdList = (items: number[], emptyText: string) => {
    if (items.length === 0) {
      return <p className="text-muted-foreground text-sm">{emptyText}</p>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {items.map((userId) => (
          <span
            key={userId}
            className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm"
          >
            用户编号 {formatUserId(userId)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <PageContainer className="py-8">
        <ProfileThemeShell className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">关注管理</h1>
            <p className="text-muted-foreground text-sm">
              管理关注、粉丝、黑名单，并查看推荐关注用户。
            </p>
            <div>
              <Button asChild variant="outline" size="sm">
                <Link href="/profile">返回个人中心</Link>
              </Button>
            </div>
          </header>

          {isLoading ? (
            <p className="text-muted-foreground">加载中...</p>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>关系操作</CardTitle>
                  <CardDescription>当前登录用户编号：{currentUserId || "--"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="follow-target-id">目标用户编号</Label>
                    <Input
                      id="follow-target-id"
                      value={targetUserId}
                      onChange={(event) => setTargetUserId(event.target.value)}
                      placeholder="输入目标用户编号"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={isActionLoading}
                      onClick={() => void handleRelationAction("follow")}
                    >
                      {isActionLoading ? "处理中..." : "关注"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={isActionLoading}
                      onClick={() => void handleRelationAction("unfollow")}
                    >
                      取消关注
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={isActionLoading}
                      onClick={() => void handleRelationAction("block")}
                    >
                      拉黑
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isActionLoading}
                      onClick={() => void handleRelationAction("unblock")}
                    >
                      取消拉黑
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isActionLoading}
                      onClick={() => token && void loadData(token)}
                    >
                      刷新列表
                    </Button>
                  </div>

                  {actionMessage && <p className="text-primary text-sm">{actionMessage}</p>}
                  {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>我的关注</CardTitle>
                    <CardDescription>最近 {PAGE_SIZE} 条关注关系</CardDescription>
                  </CardHeader>
                  <CardContent>{renderUserIdList(followIds, "暂无关注记录")}</CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>我的粉丝</CardTitle>
                    <CardDescription>最近 {PAGE_SIZE} 条粉丝关系</CardDescription>
                  </CardHeader>
                  <CardContent>{renderUserIdList(followerIds, "暂无粉丝记录")}</CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>黑名单</CardTitle>
                    <CardDescription>最近 {PAGE_SIZE} 条拉黑记录</CardDescription>
                  </CardHeader>
                  <CardContent>{renderUserIdList(blockIds, "黑名单为空")}</CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>推荐关注</CardTitle>
                    <CardDescription>基于三层关注关系生成</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recommendations.length === 0 ? (
                      <p className="text-muted-foreground text-sm">暂无推荐结果</p>
                    ) : (
                      <div className="space-y-3">
                        {recommendations.map((item) => (
                          <div key={item.target_id} className="rounded-lg border p-4">
                            <p className="font-medium">用户编号 {formatUserId(item.target_id)}</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                              共同关注分数：{item.mutual_score}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
