"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import MarkdownEditor from "@/app/post/_components/MarkdownEditor";
import { useAppPrompt } from "@/components/common/AppPromptProvider";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ArticleItem, deleteArticle, getArticle, updateArticle } from "@/services/article";
import { getAuthToken } from "@/services/auth";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toArticleItem = (value: unknown): ArticleItem | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const article = asRecord(record.article);
  if (article) {
    return article as ArticleItem;
  }

  return record as ArticleItem;
};

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm } = useAppPrompt();
  const articleId = useMemo(() => decodeURIComponent(params.id), [params.id]);

  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [manualTypeTag, setManualTypeTag] = useState("");

  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      router.replace("/login");
      return;
    }
    setToken(currentToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadArticle = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const articlePayload = await getArticle(articleId, { token });
        const article = toArticleItem(articlePayload);
        if (!article) {
          throw new Error("文章不存在或已删除");
        }

        setTitle(typeof article.title === "string" ? article.title : "");
        setBrief(typeof article.brief === "string" ? article.brief : "");
        setContent(typeof article.content === "string" ? article.content : "");
        setCoverImageUrl(
          typeof article.cover_image_url === "string"
            ? article.cover_image_url
            : typeof article.cover === "string"
              ? article.cover
              : "",
        );
        setManualTypeTag(
          typeof article.manual_type_tag === "string" ? article.manual_type_tag : "",
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "文章加载失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadArticle();
  }, [articleId, token]);

  const handleSave = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    if (!title.trim() || !content.trim()) {
      setErrorMessage("标题和正文不能为空");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateArticle(token, articleId, {
        id: articleId,
        title: title.trim(),
        brief: brief.trim() || undefined,
        content: content.trim(),
        cover_image_url: coverImageUrl.trim() || undefined,
        manual_type_tag: manualTypeTag.trim() || undefined,
      });
      setSuccessMessage("文章已更新");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "文章更新失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    const confirmed = await confirm({
      title: "确认删除文章",
      description: "此操作不可恢复，确定删除这篇文章吗？",
      confirmText: "确认删除",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteArticle(token, articleId);
      router.push("/dashboard/recommend");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <PageContainer className="py-8">
          <p className="text-muted-foreground">文章加载中...</p>
        </PageContainer>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageContainer className="bg-background flex min-h-[calc(100vh-9rem)] flex-col py-6">
        <div className="flex items-center justify-between py-8">
          <h1 className="text-primary text-center text-3xl font-extrabold tracking-tight">
            编辑文章
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push(`/article/${articleId}`)}>
              返回详情
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? "删除中..." : "删除"}
            </Button>
          </div>
        </div>

        <div className="mb-4 rounded-md border p-4">
          <div className="mb-3">
            <Label htmlFor="post-title" className="mb-2">
              文章标题（必填）
            </Label>
            <Input
              id="post-title"
              type="text"
              placeholder="请输入文章标题"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              disabled={isSaving || isDeleting}
            />
          </div>
          <div className="mb-3">
            <Label htmlFor="post-brief" className="mb-2">
              文章摘要（可选）
            </Label>
            <Input
              id="post-brief"
              type="text"
              placeholder="请输入摘要"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              disabled={isSaving || isDeleting}
            />
          </div>
          <div className="mb-3">
            <Label htmlFor="post-cover" className="mb-2">
              封面地址（可选）
            </Label>
            <Input
              id="post-cover"
              type="text"
              placeholder="请输入封面 URL"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
              disabled={isSaving || isDeleting}
            />
          </div>
          <div className="mb-3">
            <Label htmlFor="post-tag" className="mb-2">
              手动分类标签（可选）
            </Label>
            <Input
              id="post-tag"
              type="text"
              placeholder="请输入分类标签"
              value={manualTypeTag}
              onChange={(event) => setManualTypeTag(event.target.value)}
              disabled={isSaving || isDeleting}
            />
          </div>
          {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
          {successMessage && <p className="text-primary text-sm">{successMessage}</p>}
        </div>

        <div className="min-h-0 flex-1 pb-8">
          <MarkdownEditor value={content} onChange={setContent} />
        </div>
      </PageContainer>
    </Layout>
  );
}
