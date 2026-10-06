import type { Metadata } from "next";
import { Suspense } from "react";

// 流式边界（规范 §2.4：src/app/chat/layout.tsx 为 SSE 流式页的挂载边界）。
export const metadata: Metadata = {
  title: "学习问答 · Sea 识海",
  description: "面向知识库的流式学习问答：fast/balanced/deep 三档检索深度，回答附可点击引用角标。",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
