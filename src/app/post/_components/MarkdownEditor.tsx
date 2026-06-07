"use client";

import dynamic from "next/dynamic";

import { uploadArticleInlineImage } from "@/services/article";

const ByteMDEditor = dynamic(
  () => import("@/app/post/_components/ByteMDEditor").then((module) => module.ByteMDEditor),
  {
    ssr: false,
    loading: () => (
      <div className="border-border bg-card text-muted-foreground flex min-h-[360px] items-center justify-center rounded-3xl border text-sm">
        编辑器加载中...
      </div>
    ),
  },
);

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  token?: string | null;
  onUploadError?: (message: string) => void;
}

export default function MarkdownEditor({
  value,
  onChange,
  token,
  onUploadError,
}: MarkdownEditorProps) {
  return (
    <div className="h-full min-h-0">
      <ByteMDEditor
        value={value}
        onChange={onChange}
        uploadImages={async (files) => {
          if (!token) {
            const message = "请先登录后再上传正文图片";
            onUploadError?.(message);
            throw new Error(message);
          }

          try {
            const uploads = await Promise.all(
              files.map(async (file) => ({
                url: await uploadArticleInlineImage(token, file),
                alt: file.name,
                title: file.name,
              })),
            );
            return uploads;
          } catch (error) {
            const message = error instanceof Error ? error.message : "正文图片上传失败";
            onUploadError?.(message);
            throw error instanceof Error ? error : new Error(message);
          }
        }}
      />
    </div>
  );
}
