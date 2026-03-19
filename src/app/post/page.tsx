"use client";

// 内容发布页，统一使用 shadcn 表单与按钮组件。
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createArticle, MAX_COVER_UPLOAD_SIZE_LABEL, uploadArticleCover } from "@/services/article";
import { getAuthToken } from "@/services/auth";

import MarkdownEditor from "./_components/MarkdownEditor";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const extractCreatedArticleId = (payload: unknown): string | null => {
  const record = asRecord(payload);
  if (!record) {
    return null;
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
  const coverUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [manualTypeTag, setManualTypeTag] = useState("");
  const [content, setContent] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      router.replace("/login?next=/post");
      return;
    }
    setToken(currentToken);
  }, [router]);

  const handleUploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setCover(uploadedCover);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "封面上传失败，请重试");
    } finally {
      setIsUploadingCover(false);
      event.target.value = "";
    }
  };

  const handleGenerateCover = async () => {
    if (!content.trim()) {
      setErrorMessage("请先输入文章内容，再生成封面");
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
        throw new Error("Generate cover failed");
      }

      const data = (await response.json()) as { cover?: unknown };
      if (typeof data.cover !== "string" || !data.cover.trim()) {
        throw new Error("Generate cover succeeded but cover url is invalid");
      }

      const generatedCover = data.cover.trim();
      setCover(generatedCover);
      setErrorMessage(null);
      return generatedCover;
    } catch (error) {
      console.error(error);
      setErrorMessage("AI 封面生成失败，请手动上传封面后重试");
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
        setErrorMessage("文章标题不能为空");
        return;
      }

      if (!content.trim()) {
        setErrorMessage("文章内容不能为空");
        return;
      }

      setIsPublishing(true);

      let finalCover = cover;
      if (!finalCover) {
        finalCover = await handleGenerateCover();
      }

      if (!finalCover) {
        setErrorMessage("发布前必须有封面，请上传或重试 AI 生成");
        return;
      }

      const result = await createArticle(token, {
        title: title.trim(),
        brief: brief.trim() || undefined,
        content: content.trim(),
        cover_image_url: finalCover,
        manual_type_tag: manualTypeTag.trim() || undefined,
      });

      const createdId = extractCreatedArticleId(result);
      if (createdId) {
        router.push(`/article/${encodeURIComponent(createdId)}`);
        return;
      }

      router.push("/dashboard/recommend");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "发布失败，请重试");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Layout>
      <PageContainer className="bg-background flex min-h-[calc(100vh-9rem)] flex-col py-6">
        <div className="flex items-center justify-between py-8">
          <h1 className="text-primary text-center text-3xl font-extrabold tracking-tight">
            编辑内容
          </h1>
          <Button
            onClick={handlePublish}
            disabled={isPublishing || isUploadingCover || isGeneratingCover}
          >
            {isPublishing ? "发布中..." : "发布"}
          </Button>
        </div>
        <div className="mb-4 rounded-md border p-4">
          {errorMessage && <p className="text-destructive mb-3 text-sm">{errorMessage}</p>}
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
              disabled={isPublishing || isUploadingCover || isGeneratingCover}
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
              maxLength={200}
              disabled={isPublishing || isUploadingCover || isGeneratingCover}
            />
          </div>
          <div className="mb-3">
            <Label htmlFor="post-tag" className="mb-2">
              分类标签（可选）
            </Label>
            <Input
              id="post-tag"
              type="text"
              placeholder="如：travel"
              value={manualTypeTag}
              onChange={(event) => setManualTypeTag(event.target.value)}
              maxLength={40}
              disabled={isPublishing || isUploadingCover || isGeneratingCover}
            />
          </div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="w-full">
              <Label htmlFor="cover-upload" className="mb-2">
                文章封面（必填）
              </Label>
              <Input
                id="cover-upload"
                ref={coverUploadInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadCover}
                disabled={isUploadingCover || isGeneratingCover || isPublishing}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                上传图片大小需不超过 {MAX_COVER_UPLOAD_SIZE_LABEL}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleGenerateCover}
              disabled={isUploadingCover || isGeneratingCover || isPublishing}
            >
              {isGeneratingCover ? "AI 生成中..." : "AI 生成封面"}
            </Button>
          </div>
          {isUploadingCover && <p className="text-muted-foreground text-sm">封面上传中...</p>}
          {!isUploadingCover && !cover && (
            <p className="text-muted-foreground text-sm">未上传封面时，发布会自动触发 AI 生成。</p>
          )}
          {cover && (
            <div className="relative mt-2 h-48 w-full overflow-hidden rounded-md border">
              <Image src={cover} alt="cover preview" fill className="object-cover" />
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 pb-8">
          <MarkdownEditor value={content} onChange={setContent} />
        </div>
      </PageContainer>
    </Layout>
  );
}
