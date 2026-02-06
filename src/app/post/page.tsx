"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import MarkdownEditor from "./_components/MarkdownEditor";

export default function PostPage() {
  const [content, setContent] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Publish failed");
      }

      const data = await response.json();
      alert(`发布成功！文件已保存至: ${data.path}`);
    } catch (error) {
      console.error(error);
      alert("发布失败，请重试");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="bg-background flex h-screen w-full flex-col overflow-hidden">
      <div className="mx-auto flex h-full w-3/4 flex-col">
        <div className="flex items-center justify-between py-8">
          <h1 className="text-primary text-center text-3xl font-extrabold tracking-tight">
            编辑内容
          </h1>
          <Button onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? "发布中..." : "发布"}
          </Button>
        </div>
        <div className="min-h-0 flex-1 pb-8">
          <MarkdownEditor value={content} onChange={setContent} />
        </div>
      </div>
    </div>
  );
}
