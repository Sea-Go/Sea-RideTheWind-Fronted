"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileThemeShell } from "@/components/profile/ProfileThemeShell";
import { Button } from "@/components/ui/button";
import { ADMIN_FRONTEND_SESSION_MESSAGE, getFrontendAccessState } from "@/services/auth";
import { getUserLikeList, getUserTotalLike, type UserLikeItem } from "@/services/like";

const PAGE_SIZE = 20;

const formatTimestamp = (timestamp: number): string => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "--";
  }

  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
  });
};

export default function ProfileLikesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [totalLikeCount, setTotalLikeCount] = useState(0);
  const [items, setItems] = useState<UserLikeItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [isEnd, setIsEnd] = useState(false);

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/profile/likes");
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

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [totalLikeResult, likeListResult] = await Promise.all([
          getUserTotalLike(token),
          getUserLikeList(token, {
            target_type: "article",
            cursor: 0,
            page_size: PAGE_SIZE,
          }),
        ]);

        setTotalLikeCount(totalLikeResult.total_like_count ?? 0);
        setItems(Array.isArray(likeListResult.list) ? likeListResult.list : []);
        setCursor(likeListResult.next_cursor ?? 0);
        setIsEnd(Boolean(likeListResult.is_end));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载点赞数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [token]);

  const handleLoadMore = async () => {
    if (!token || isEnd || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const likeListResult = await getUserLikeList(token, {
        target_type: "article",
        cursor,
        page_size: PAGE_SIZE,
      });

      setItems((prev) => [...prev, ...(likeListResult.list ?? [])]);
      setCursor(likeListResult.next_cursor ?? cursor);
      setIsEnd(Boolean(likeListResult.is_end));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载更多点赞记录失败");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="py-8">
        <ProfileThemeShell className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">我的点赞</h1>
            <p className="text-muted-foreground text-sm">
              查看我点过赞的文章，也可以直接回到原文继续阅读。
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
            <>
              <section className="rounded-xl border p-6">
                <p className="text-muted-foreground text-sm">累计获赞</p>
                <p className="mt-2 text-4xl font-bold">{totalLikeCount}</p>
              </section>

              <section className="space-y-4 rounded-xl border p-6">
                <h2 className="text-xl font-semibold">点赞记录</h2>
                {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}

                {!errorMessage && items.length === 0 ? (
                  <p className="text-muted-foreground text-sm">暂无点赞记录</p>
                ) : null}

                {items.length > 0 ? (
                  <div className="space-y-3">
                    {items.map((item, index) => {
                      const articleHref =
                        item.target_type === "article" && item.target_id
                          ? `/article/${encodeURIComponent(item.target_id)}`
                          : null;

                      return (
                        <div
                          key={`${item.target_id}-${item.timestamp}-${index}`}
                          className="space-y-3 rounded-lg border p-4"
                        >
                          <div className="space-y-1">
                            <p className="text-sm">
                              目标类型：<span className="font-medium">{item.target_type}</span>
                            </p>
                            <p className="text-sm">
                              目标编号：<span className="font-mono">{item.target_id}</span>
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              点赞时间：{formatTimestamp(item.timestamp)}
                            </p>
                          </div>

                          {articleHref ? (
                            <Button asChild variant="outline" size="sm">
                              <Link href={articleHref}>进入文章</Link>
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {!isEnd && items.length > 0 ? (
                  <Button variant="secondary" onClick={handleLoadMore} disabled={isLoadingMore}>
                    {isLoadingMore ? "加载中..." : "加载更多"}
                  </Button>
                ) : null}
              </section>
            </>
          )}
        </ProfileThemeShell>
      </PageContainer>
    </Layout>
  );
}
