"use client";

// 内容发布页，统一使用 shadcn 表单与按钮组件。
import Image from "next/image";
import { useRef, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import MarkdownEditor from "./_components/MarkdownEditor";

export default function PostPage() {
  const coverUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleUploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsUploadingCover(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cover/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload cover failed");
      }

      const data = await response.json();
      setCover(data.cover);
    } catch (error) {
      console.error(error);
      alert("封面上传失败，请重试");
    } finally {
      setIsUploadingCover(false);
      event.target.value = "";
    }
  };

  const handleGenerateCover = async () => {
    if (!content.trim()) {
      alert("请先输入文章内容，再生成封面");
      return null;
    }

    try {
      setIsGeneratingCover(true);
      const response = await fetch("/api/cover/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      return generatedCover;
    } catch (error) {
      console.error(error);
      alert("AI 封面生成失败，请手动上传封面后重试");
      return null;
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handlePublish = async () => {
    try {
      if (!title.trim()) {
        alert("文章标题不能为空");
        return;
      }

      if (!content.trim()) {
        alert("文章内容不能为空");
        return;
      }

      setIsPublishing(true);

      let finalCover = cover;
      if (!finalCover) {
        finalCover = await handleGenerateCover();
      }

      if (!finalCover) {
        alert("发布前必须有封面，请上传或重试 AI 生成");
        return;
      }

      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, content, cover: finalCover }),
      });

      if (!response.ok) {
        throw new Error("Publish failed");
      }

      const data = await response.json();
      alert(`发布成功！文件已保存至: ${data.path}，封面: ${data.cover}`);
      setTitle("");
      setContent("");
      setCover(null);
      if (coverUploadInputRef.current) {
        coverUploadInputRef.current.value = "";
      }
    } catch (error) {
      console.error(error);
      alert("发布失败，请重试");
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
