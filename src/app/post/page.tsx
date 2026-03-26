"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createArticle, MAX_COVER_UPLOAD_SIZE_LABEL, uploadArticleCover } from "@/services/article";
import { getAuthToken } from "@/services/auth";

import MarkdownEditor from "./_components/MarkdownEditor";
import SecondaryTagsInput from "./_components/SecondaryTagsInput";

const COVER_GENERATION_HINT =
  "根据标题和正文内容自动生成封面；如果没有手动上传封面，发布前也会自动尝试生成。";

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
  const [isCoverPreviewFailed, setIsCoverPreviewFailed] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setCoverWithPreviewReset = (nextCover: string | null) => {
    setCover(nextCover);
    setIsCoverPreviewFailed(false);
  };

  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      router.replace("/login?next=/post");
      return;
    }
    setToken(currentToken);
  }, [router]);

  const handleUploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      if (!token) {
        router.push("/login?next=/post");
        return;
      }

      setIsUploadingCover(true);
      const uploadedCover = await uploadArticleCover(token, file);
      setCoverWithPreviewReset(uploadedCover);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "封面上传失败，请稍后重试。");
    } finally {
      setIsUploadingCover(false);
      event.target.value = "";
    }
  };

  const handleGenerateCover = async () => {
    if (!content.trim()) {
      setErrorMessage("请先输入文章正文，再生成封面。");
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
        throw new Error(responseText || "封面生成失败。");
      }

      const data = (await response.json()) as { cover?: unknown };
      if (typeof data.cover !== "string" || !data.cover.trim()) {
        throw new Error("封面生成成功，但返回的地址无效。");
      }

      const generatedCover = data.cover.trim();
      setCoverWithPreviewReset(generatedCover);
      setErrorMessage(null);
      return generatedCover;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "智能封面生成失败，请手动上传封面。",
      );
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
        setErrorMessage("标题不能为空。");
        return;
      }
      if (!content.trim()) {
        setErrorMessage("正文内容不能为空。");
        return;
      }

      setIsPublishing(true);

      let finalCover = cover;
      if (!finalCover) {
        finalCover = await handleGenerateCover();
      }
      if (!finalCover) {
        setErrorMessage("发布前必须提供封面。");
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

  return (
    <Layout>
      <PageContainer className="bg-background flex min-h-[calc(100vh-9rem)] flex-col py-6">
        <div className="flex items-center justify-between py-8">
          <h1 className="text-primary text-center text-3xl font-extrabold tracking-tight">
            发布文章
          </h1>
          <Button
            onClick={handlePublish}
            disabled={isPublishing || isUploadingCover || isGeneratingCover}
          >
            {isPublishing ? "发布中..." : "发布"}
          </Button>
        </div>

        <div className="mb-4 space-y-4 rounded-md border p-4">
          {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}

          <div className="space-y-2">
            <Label htmlFor="post-title">标题</Label>
            <Input
              id="post-title"
              type="text"
              placeholder="请输入文章标题"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              disabled={isPublishing || isUploadingCover || isGeneratingCover}
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
              maxLength={200}
              disabled={isPublishing || isUploadingCover || isGeneratingCover}
            />
          </div>

          <SecondaryTagsInput
            tags={secondaryTags}
            onChange={setSecondaryTags}
            disabled={isPublishing || isUploadingCover || isGeneratingCover}
          />

          <div className="flex items-start justify-between gap-4">
            <div className="w-full space-y-2">
              <Label htmlFor="cover-upload">封面图片</Label>
              <Input
                id="cover-upload"
                type="file"
                accept="image/*"
                onChange={handleUploadCover}
                disabled={isUploadingCover || isGeneratingCover || isPublishing}
              />
              <p className="text-muted-foreground text-xs">
                最大上传大小：{MAX_COVER_UPLOAD_SIZE_LABEL}
              </p>
            </div>
            <div className="group relative shrink-0">
              <Button
                variant="outline"
                onClick={() => void handleGenerateCover()}
                disabled={isUploadingCover || isGeneratingCover || isPublishing}
                aria-describedby="cover-generate-tooltip"
              >
                {isGeneratingCover ? "生成中..." : "智能生成封面"}
              </Button>
              <div
                id="cover-generate-tooltip"
                role="tooltip"
                className="bg-background/95 text-muted-foreground pointer-events-none absolute top-full right-0 z-20 mt-2 hidden w-72 rounded-lg border p-3 text-xs leading-5 shadow-lg backdrop-blur-sm group-focus-within:block group-hover:block"
              >
                {COVER_GENERATION_HINT}
              </div>
            </div>
          </div>

          {isUploadingCover && <p className="text-muted-foreground text-sm">封面上传中...</p>}

          {!isUploadingCover && !cover && (
            <p className="text-muted-foreground text-sm">
              如果你没有上传封面，系统会在发布时尝试自动生成。
            </p>
          )}

          {cover && (
            <div className="mt-2 space-y-2">
              <div className="overflow-hidden rounded-md border">
                {isCoverPreviewFailed ? (
                  <div className="flex h-48 items-center justify-center bg-slate-50 px-4 text-center text-sm text-amber-700">
                    当前封面地址暂时无法预览，请重新上传封面，或稍后再试。
                  </div>
                ) : (
                  <img
                    src={cover}
                    alt="封面预览"
                    className="h-48 w-full object-cover"
                    onError={() => setIsCoverPreviewFailed(true)}
                  />
                )}
              </div>
              {isCoverPreviewFailed && (
                <p className="text-sm text-amber-700">
                  封面地址已保留，但浏览器当前无法加载这张图片。
                </p>
              )}
            </div>
          )}
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
