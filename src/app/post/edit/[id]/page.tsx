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
import { buildCoverPreviewSrc } from "@/lib/cover-preview";
import { type ArticleItem, deleteArticle, getArticle, updateArticle } from "@/services/article";
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
  const [isCoverPreviewFailed, setIsCoverPreviewFailed] = useState(false);

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
        setIsCoverPreviewFailed(false);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "文章加载失败。");
      } finally {
        setIsLoading(false);
      }
    };

    void loadArticle();
  }, [articleId, token]);

  const canEdit = Boolean(currentUserId && articleAuthorId && currentUserId === articleAuthorId);
  const coverPreviewSrc = buildCoverPreviewSrc(coverImageUrl);

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
      setIsCoverPreviewFailed(false);
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
      router.push("/profile/articles");
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
      <PageContainer className="py-5 sm:py-6 lg:py-8">
        <div className="space-y-5">
          <header className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                编辑文章
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">继续完善这篇内容</h1>
              <p className="text-muted-foreground max-w-3xl text-sm leading-6">
                你可以调整标题、摘要、封面地址、标签与正文。保存后，系统会重新进入文章同步和审核流程。
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
              <Button
                variant="outline"
                onClick={() => router.push(`/article/${encodeURIComponent(articleId)}`)}
                className="w-full sm:w-auto"
              >
                查看文章
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || isDeleting || !canEdit}
                className="w-full sm:w-auto"
              >
                {isSaving ? "保存中..." : "保存修改"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={isSaving || isDeleting || !canEdit}
                className="w-full sm:w-auto"
              >
                {isDeleting ? "删除中..." : "删除文章"}
              </Button>
            </div>
          </header>

          {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
          {successMessage ? <p className="text-primary text-sm">{successMessage}</p> : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <section className="space-y-4 rounded-[1.75rem] border bg-white/85 p-4 shadow-sm sm:p-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 xl:col-span-2">
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

                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="post-brief">摘要</Label>
                  <Input
                    id="post-brief"
                    type="text"
                    placeholder="请输入文章摘要"
                    value={brief}
                    onChange={(event) => setBrief(event.target.value)}
                    maxLength={200}
                    disabled={isSaving || isDeleting || !canEdit}
                  />
                </div>

                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="post-cover">封面地址</Label>
                  <Input
                    id="post-cover"
                    type="text"
                    placeholder="请输入封面地址"
                    value={coverImageUrl}
                    onChange={(event) => {
                      setCoverImageUrl(event.target.value);
                      setIsCoverPreviewFailed(false);
                    }}
                    disabled={isSaving || isDeleting || !canEdit}
                  />
                </div>
              </div>

              <SecondaryTagsInput
                tags={secondaryTags}
                onChange={setSecondaryTags}
                disabled={isSaving || isDeleting || !canEdit}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">正文内容</h2>
                  <span className="text-muted-foreground text-xs">
                    当前字数 {content.trim().length}
                  </span>
                </div>
                <div className="min-h-0 pb-2">
                  <MarkdownEditor
                    value={content}
                    onChange={setContent}
                    token={token}
                    onUploadError={setErrorMessage}
                  />
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-[1.75rem] border bg-white/85 p-4 shadow-sm sm:p-5">
                <h2 className="text-base font-semibold">当前封面预览</h2>
                <p className="text-muted-foreground mt-2 text-xs leading-5">
                  这里会直接展示当前文章的封面，方便在编辑阶段核对发布后用户最终看到的效果。
                </p>

                {!coverPreviewSrc ? (
                  <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    当前还没有可预览的封面地址。
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="overflow-hidden rounded-[1.5rem] border bg-slate-50">
                      {isCoverPreviewFailed ? (
                        <div className="flex min-h-56 items-center justify-center px-4 text-center text-sm text-amber-700">
                          当前封面地址暂时无法预览，请检查地址是否有效，或重新回到发文页上传封面。
                        </div>
                      ) : (
                        <img
                          src={coverPreviewSrc}
                          alt="封面预览"
                          className="h-56 w-full object-cover sm:h-64"
                          onError={() => setIsCoverPreviewFailed(true)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-[1.75rem] border bg-white/85 p-4 shadow-sm sm:p-5">
                <h2 className="text-base font-semibold">编辑提醒</h2>
                <ul className="text-muted-foreground mt-3 space-y-2 text-sm leading-6">
                  <li>保存前确认标题、摘要和正文都已同步更新。</li>
                  <li>如果修改了封面地址，先看右侧预览是否正常。</li>
                  <li>保存后文章可能重新进入审核，状态会在文章管理页更新。</li>
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </PageContainer>
    </Layout>
  );
}
