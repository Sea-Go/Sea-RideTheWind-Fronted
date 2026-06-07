"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useRef, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildCoverPreviewSrc } from "@/lib/cover-preview";
import { createArticle, MAX_COVER_UPLOAD_SIZE_LABEL, uploadArticleCover } from "@/services/article";
import { ADMIN_FRONTEND_SESSION_MESSAGE, getFrontendAccessState } from "@/services/auth";

import MarkdownEditor from "./_components/MarkdownEditor";
import SecondaryTagsInput from "./_components/SecondaryTagsInput";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const extractCreatedArticleId = (payload: unknown): string | null => {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const dataRecord = asRecord(record.data);
  if (dataRecord) {
    const dataId = dataRecord.id ?? dataRecord.article_id;
    if (dataId !== undefined && dataId !== null && String(dataId).trim()) {
      return String(dataId).trim();
    }
  }

  const directId = record.id ?? record.article_id;
  if (directId !== undefined && directId !== null && String(directId).trim()) {
    return String(directId).trim();
  }

  const article = asRecord(record.article);
  if (!article) {
    return null;
  }

  const nestedId = article.id ?? article.article_id;
  if (nestedId !== undefined && nestedId !== null && String(nestedId).trim()) {
    return String(nestedId).trim();
  }

  return null;
};

export default function PostPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [secondaryTags, setSecondaryTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [coverPreviewSrc, setCoverPreviewSrc] = useState<string | null>(null);
  const [isCoverPreviewFailed, setIsCoverPreviewFailed] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const localCoverPreviewUrlRef = useRef<string | null>(null);

  const revokeLocalPreviewUrl = (previewUrl: string | null) => {
    if (!previewUrl || !previewUrl.startsWith("blob:")) {
      return;
    }
    URL.revokeObjectURL(previewUrl);
  };

  const clearLocalCoverPreview = () => {
    revokeLocalPreviewUrl(localCoverPreviewUrlRef.current);
    localCoverPreviewUrlRef.current = null;
  };

  const setCoverWithPreviewReset = (nextCover: string | null) => {
    clearLocalCoverPreview();
    setCover(nextCover);
    setCoverPreviewSrc(buildCoverPreviewSrc(nextCover));
    setIsCoverPreviewFailed(false);
  };

  const syncUploadedCoverPreview = (
    uploadedCover: string,
    expectedLocalPreviewUrl: string | null,
  ) => {
    setCover(uploadedCover);

    const remotePreviewSrc = buildCoverPreviewSrc(uploadedCover);
    if (!remotePreviewSrc || remotePreviewSrc.startsWith("blob:")) {
      if (remotePreviewSrc) {
        setCoverPreviewSrc(remotePreviewSrc);
      }
      setIsCoverPreviewFailed(false);
      return;
    }

    if (typeof window === "undefined") {
      setCoverPreviewSrc(remotePreviewSrc);
      setIsCoverPreviewFailed(false);
      return;
    }

    const previewImage = new window.Image();
    previewImage.onload = () => {
      if (expectedLocalPreviewUrl && localCoverPreviewUrlRef.current !== expectedLocalPreviewUrl) {
        return;
      }

      revokeLocalPreviewUrl(expectedLocalPreviewUrl);
      if (expectedLocalPreviewUrl && localCoverPreviewUrlRef.current === expectedLocalPreviewUrl) {
        localCoverPreviewUrlRef.current = null;
      }

      setCoverPreviewSrc(remotePreviewSrc);
      setIsCoverPreviewFailed(false);
    };
    previewImage.onerror = () => {
      if (expectedLocalPreviewUrl && localCoverPreviewUrlRef.current !== expectedLocalPreviewUrl) {
        return;
      }

      // Keep the already visible local blob preview as the fallback.
      setIsCoverPreviewFailed(false);
    };
    previewImage.src = remotePreviewSrc;
  };

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/post");
      return;
    }

    if (!userToken) {
      setErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      return;
    }

    setToken(userToken);
    setErrorMessage(null);
  }, [router]);

  useEffect(() => {
    return () => {
      revokeLocalPreviewUrl(localCoverPreviewUrlRef.current);
      localCoverPreviewUrlRef.current = null;
    };
  }, []);

  const handleUploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const previousCover = cover;
    const previousPreviewSrc = coverPreviewSrc;
    const previousLocalPreviewUrl = localCoverPreviewUrlRef.current;
    const nextLocalPreviewUrl = URL.createObjectURL(file);

    localCoverPreviewUrlRef.current = nextLocalPreviewUrl;
    setCoverPreviewSrc(nextLocalPreviewUrl);
    setIsCoverPreviewFailed(false);

    try {
      if (!token) {
        localCoverPreviewUrlRef.current = previousLocalPreviewUrl;
        revokeLocalPreviewUrl(nextLocalPreviewUrl);
        setCoverPreviewSrc(previousPreviewSrc);
        router.push("/login?next=/post");
        return;
      }

      setIsUploadingCover(true);
      const uploadedCover = await uploadArticleCover(token, file);
      revokeLocalPreviewUrl(previousLocalPreviewUrl);
      syncUploadedCoverPreview(uploadedCover, nextLocalPreviewUrl);
      setErrorMessage(null);
    } catch (error) {
      localCoverPreviewUrlRef.current = previousLocalPreviewUrl;
      revokeLocalPreviewUrl(nextLocalPreviewUrl);
      setCover(previousCover);
      setCoverPreviewSrc(previousPreviewSrc);
      setIsCoverPreviewFailed(false);
      setErrorMessage(error instanceof Error ? error.message : "封面上传失败，请稍后重试。");
    } finally {
      setIsUploadingCover(false);
      event.target.value = "";
    }
  };

  const handleGenerateCover = async () => {
    if (!content.trim()) {
      setErrorMessage("请先填写正文内容，再生成封面。");
      return null;
    }

    if (!token) {
      router.push("/login?next=/post");
      return null;
    }

    try {
      setIsGeneratingCover(true);
      const response = await fetch("/api/cover/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(responseText || "封面生成失败，请稍后重试。");
      }

      const data = (await response.json()) as { cover?: unknown };
      if (typeof data.cover !== "string" || !data.cover.trim()) {
        throw new Error("封面生成成功，但返回的封面地址无效。");
      }

      const generatedCover = data.cover.trim();
      setCoverWithPreviewReset(generatedCover);
      setErrorMessage(null);
      return generatedCover;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI 封面生成失败，请稍后重试。");
      return null;
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handlePublish = async () => {
    try {
      if (!token) {
        router.push("/login?next=/post");
        return;
      }

      setErrorMessage(null);

      if (!title.trim()) {
        setErrorMessage("请输入文章标题。");
        return;
      }

      if (!content.trim()) {
        setErrorMessage("请输入正文内容。");
        return;
      }

      setIsPublishing(true);

      let finalCover = cover;
      if (!finalCover) {
        finalCover = await handleGenerateCover();
      }

      if (!finalCover) {
        setErrorMessage("封面尚未准备好，请先上传封面或重新生成。");
        return;
      }

      const result = await createArticle(token, {
        title: title.trim(),
        brief: brief.trim() || undefined,
        content: content.trim(),
        cover_image_url: finalCover,
        secondary_tags: secondaryTags,
      });

      const createdId = extractCreatedArticleId(result);
      if ((result.code === 200 || result.code === 1003) && createdId) {
        router.push(`/article/${encodeURIComponent(createdId)}`);
        return;
      }

      throw new Error(result.msg || "发布失败，请稍后重试。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "发布失败，请稍后重试。");
    } finally {
      setIsPublishing(false);
    }
  };

  const hasCoverPreview = Boolean(coverPreviewSrc || cover);
  const pageBusy = isPublishing || isUploadingCover || isGeneratingCover;

  return (
    <Layout>
      <PageContainer className="py-5 sm:py-6 lg:py-8">
        <div className="space-y-5">
          <header className="app-hero-surface flex flex-col gap-4 rounded-[1.75rem] p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="app-pill inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium">
                发布文章
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">创建一篇新文章</h1>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
              <Button
                variant="outline"
                onClick={() => router.push("/profile/articles")}
                disabled={pageBusy}
                className="w-full sm:w-auto"
              >
                查看文章管理
              </Button>
              <Button onClick={handlePublish} disabled={pageBusy} className="w-full sm:w-auto">
                {isPublishing ? "发布中..." : "发布文章"}
              </Button>
            </div>
          </header>

          {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <section className="app-surface space-y-4 rounded-[1.75rem] p-4 sm:p-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="post-title">文章标题</Label>
                  <Input
                    id="post-title"
                    type="text"
                    placeholder="请输入文章标题"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={60}
                    disabled={pageBusy}
                  />
                </div>

                <div className="space-y-2 xl:col-span-2">
                  <Label htmlFor="post-brief">文章摘要</Label>
                  <Input
                    id="post-brief"
                    type="text"
                    placeholder="请输入文章摘要"
                    value={brief}
                    onChange={(event) => setBrief(event.target.value)}
                    maxLength={200}
                    disabled={pageBusy}
                  />
                </div>
              </div>

              <SecondaryTagsInput
                tags={secondaryTags}
                onChange={setSecondaryTags}
                disabled={pageBusy}
              />

              <div className="app-surface-soft space-y-4 rounded-[1.5rem] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="w-full space-y-2">
                    <Label htmlFor="cover-upload">封面图片</Label>
                    <Input
                      id="cover-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleUploadCover}
                      disabled={pageBusy}
                    />
                    <p className="text-muted-foreground text-xs">
                      支持常见图片格式，单张图片大小不超过 {MAX_COVER_UPLOAD_SIZE_LABEL}
                    </p>
                  </div>
                  <div className="w-full max-w-full lg:w-auto lg:max-w-56">
                    <Button
                      variant="outline"
                      onClick={() => void handleGenerateCover()}
                      disabled={pageBusy}
                      className="w-full"
                    >
                      {isGeneratingCover ? "生成中..." : "AI 生成封面"}
                    </Button>
                  </div>
                </div>

                {isUploadingCover ? (
                  <p className="text-muted-foreground text-sm">封面上传中...</p>
                ) : null}
              </div>

              <section className="app-surface-elevated space-y-3 rounded-[1.5rem] p-4">
                <div className="space-y-2">
                  <h2 className="text-base font-semibold">封面预览</h2>
                </div>

                {!isUploadingCover && !hasCoverPreview ? (
                  <div className="app-empty-state rounded-[1.5rem] px-4 py-8 text-center text-sm">
                    暂无封面
                  </div>
                ) : null}

                {hasCoverPreview ? (
                  <div className="space-y-3">
                    <div className="app-media-frame overflow-hidden rounded-[1.5rem]">
                      {isCoverPreviewFailed ? (
                        <div className="flex min-h-56 items-center justify-center px-4 text-center text-sm text-amber-700">
                          当前封面地址暂时无法预览，请重新上传封面，或稍后再试。
                        </div>
                      ) : (
                        <img
                          src={coverPreviewSrc ?? cover ?? ""}
                          alt="封面预览"
                          className="h-56 w-full object-cover sm:h-64"
                          onError={() => setIsCoverPreviewFailed(true)}
                        />
                      )}
                    </div>
                    {isCoverPreviewFailed ? (
                      <p className="text-sm text-amber-700">
                        封面地址已保留，但浏览器当前无法加载这张图片。
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">正文编辑区</h2>
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
          </div>
        </div>
      </PageContainer>
    </Layout>
  );
}
