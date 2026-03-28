"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import MarkdownEditor from "@/app/post/_components/MarkdownEditor";
import SecondaryTagsInput from "@/app/post/_components/SecondaryTagsInput";
import { useAppPrompt } from "@/components/common/AppPromptProvider";
import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteArticle, getArticle, type ArticleItem, updateArticle } from "@/services/article";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  getFrontendAccessState,
  getUserProfile,
} from "@/services/auth";

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

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm } = useAppPrompt();
  const articleId = useMemo(() => decodeURIComponent(params.id), [params.id]);

  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [articleAuthorId, setArticleAuthorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [secondaryTags, setSecondaryTags] = useState<string[]>([]);

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace(`/login?next=/post/edit/${encodeURIComponent(articleId)}`);
      return;
    }

    if (!userToken) {
      setErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setIsLoading(false);
      return;
    }

    setToken(userToken);
    setErrorMessage(null);
  }, [articleId, router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadArticle = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const [profile, articlePayload] = await Promise.all([
          getUserProfile(token),
          getArticle(articleId, { token, incr_view: false }),
        ]);

        const article = toArticleItem(articlePayload);
        if (!article) {
          throw new Error("文章不存在或已被删除。");
        }

        const nextCurrentUserId = String(profile.user.uid ?? "").trim();
        const nextAuthorId = String(article.author_id ?? "").trim();
        setCurrentUserId(nextCurrentUserId || null);
        setArticleAuthorId(nextAuthorId || null);

        if (!nextCurrentUserId || nextCurrentUserId !== nextAuthorId) {
          setErrorMessage("你只能编辑自己的文章。");
          return;
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
        setSecondaryTags(normalizeStringArray(article.secondary_tags));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "文章加载失败。");
      } finally {
        setIsLoading(false);
      }
    };

    void loadArticle();
  }, [articleId, token]);

  const canEdit = Boolean(currentUserId && articleAuthorId && currentUserId === articleAuthorId);

  const handleSave = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!canEdit) {
      setErrorMessage("你只能编辑自己的文章。");
      return;
    }
    if (!title.trim() || !content.trim()) {
      setErrorMessage("标题和正文内容不能为空。");
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
        secondary_tags: secondaryTags,
      });
      setSuccessMessage("文章已更新。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "文章更新失败。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!canEdit) {
      setErrorMessage("你只能删除自己的文章。");
      return;
    }

    const confirmed = await confirm({
      title: "确认删除文章？",
      description: "删除后无法恢复，请再次确认。",
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
      setErrorMessage(error instanceof Error ? error.message : "删除失败。");
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
              查看文章
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isDeleting || !canEdit}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isSaving || isDeleting || !canEdit}
            >
              {isDeleting ? "删除中..." : "删除"}
            </Button>
          </div>
        </div>

        <div className="mb-4 space-y-4 rounded-md border p-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">标题</Label>
            <Input
              id="post-title"
              type="text"
              placeholder="请输入文章标题"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              disabled={isSaving || isDeleting || !canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-brief">摘要</Label>
            <Input
              id="post-brief"
              type="text"
              placeholder="请输入文章摘要"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              disabled={isSaving || isDeleting || !canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-cover">封面地址</Label>
            <Input
              id="post-cover"
              type="text"
              placeholder="请输入封面地址"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
              disabled={isSaving || isDeleting || !canEdit}
            />
          </div>

          <SecondaryTagsInput
            tags={secondaryTags}
            onChange={setSecondaryTags}
            disabled={isSaving || isDeleting || !canEdit}
          />

          {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
          {successMessage && <p className="text-primary text-sm">{successMessage}</p>}
        </div>

        <div className="min-h-0 flex-1 pb-8">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            token={token}
            onUploadError={setErrorMessage}
          />
        </div>
      </PageContainer>
    </Layout>
  );
}
