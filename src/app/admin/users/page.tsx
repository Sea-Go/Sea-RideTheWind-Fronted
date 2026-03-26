"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AdminGetUserListResponse,
  type AdminUserProfile,
  getAdminAuthToken,
  getAdminUserList,
} from "@/services/admin";

const PAGE_SIZE = 20;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const pickArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const keys = ["list", "users", "items", "records", "rows"] as const;
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (record.data) {
    return pickArray(record.data);
  }

  return [];
};

const pickTotal = (payload: unknown): number => {
  const record = asRecord(payload);
  if (!record) {
    return 0;
  }

  const totalCandidate = record.total ?? record.total_count ?? record.count;
  if (typeof totalCandidate === "number") {
    return totalCandidate;
  }

  if (record.data) {
    return pickTotal(record.data);
  }

  return 0;
};

const toAdminUserProfile = (value: unknown): AdminUserProfile | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const uid = record.uid ?? record.user_id ?? record.id;
  if (uid === undefined || uid === null) {
    return null;
  }

  const usernameValue = record.username ?? record.name;
  const username = typeof usernameValue === "string" ? usernameValue : String(usernameValue ?? "");
  if (!username) {
    return null;
  }

  return {
    uid: String(uid),
    username,
    email: typeof record.email === "string" ? record.email : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
    extra_info: asRecord(record.extra_info) ?? undefined,
  };
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminUserProfile[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const currentToken = getAdminAuthToken();
    if (!currentToken) {
      router.replace("/admin/login?next=/admin/users");
      return;
    }
    setToken(currentToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadUsers = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response: AdminGetUserListResponse = await getAdminUserList(token, {
          page,
          page_size: PAGE_SIZE,
          keyword: keyword || undefined,
        });

        const rawItems = pickArray(response);
        const normalizedItems = rawItems
          .map((item) => toAdminUserProfile(item))
          .filter((item): item is AdminUserProfile => Boolean(item));

        setItems(normalizedItems);
        setTotal(pickTotal(response));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "用户列表加载失败");
        setItems([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    void loadUsers();
  }, [keyword, page, token]);

  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  const handleSearch = () => {
    setPage(1);
    setKeyword(keywordInput.trim());
  };

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground text-sm">支持分页检索与用户详情跳转。</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">返回管理首页</Link>
          </Button>
        </header>

        <section className="flex flex-col gap-3 rounded-xl border p-6 sm:flex-row sm:items-center">
          <Input
            placeholder="输入关键词（用户名/邮箱）"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
          />
          <Button onClick={handleSearch}>搜索</Button>
        </section>

        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : (
          <section className="space-y-4 rounded-xl border p-6">
            {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}

            {!errorMessage && items.length === 0 && (
              <p className="text-muted-foreground text-sm">暂无用户数据</p>
            )}

            {items.length > 0 && (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={String(item.uid)} className="space-y-2 rounded-lg border p-4">
                    <p className="text-sm">
                      用户编号：<span className="font-mono">{item.uid}</span>
                    </p>
                    <p className="text-sm">用户名：{item.username || "--"}</p>
                    <p className="text-sm">邮箱：{item.email || "--"}</p>
                    <p className="text-sm">状态：{item.status === 1 ? "已封禁" : "正常"}</p>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/admin/users/${encodeURIComponent(String(item.uid))}`}>
                        查看详情
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-muted-foreground text-xs">
                第 {page} / {totalPages} 页 {total > 0 ? `· 共 ${total} 条` : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </section>
        )}
      </PageContainer>
    </Layout>
  );
}
