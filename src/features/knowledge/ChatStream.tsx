"use client";

import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ChatStreamMessage, ChatStreamStatus } from "./chat-stream";

import "./chat-stream.css";

export interface ChatStreamProps {
  messages: ChatStreamMessage[];
  status: ChatStreamStatus;
  error?: string | null;
  /** 点击行内引用角标 [n] 时触发。 */
  onViewCitation?: (n: number) => void;
  /** 流式失败后的显式重试（组件不自持请求状态）。 */
  onRetry?: () => void;
  retryDisabled?: boolean;
  className?: string;
}

const CITATION_PATTERN = /\[(\d+)\]/g;

/** 把含 [n] 角标的纯文本渲染为“文本 + 上标引用链接”序列。 */
const renderTextWithCitations = (
  text: string,
  keyPrefix: string,
  onViewCitation?: (n: number) => void,
): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(CITATION_PATTERN);
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const n = Number.parseInt(match[1] as string, 10);
    nodes.push(
      <button
        key={`${keyPrefix}-cite-${index++}`}
        type="button"
        className="chat-stream-citation"
        aria-label={`查看引用 ${n}`}
        onClick={() => onViewCitation?.(n)}
      >
        {n}
      </button>,
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
};

const isStreamingStatus = (status: ChatStreamStatus) =>
  status === "streaming" || status === "reconnecting";

/**
 * 流式消息渲染（视觉规范 §C/§E）：
 * - AI 消息为文档流（全宽左对齐、无气泡底），用户消息为右侧 primary 气泡；
 * - 流式中的最后一条 AI 消息末尾渲染块状 caret（CSS steps(2) 1s，reduce 静态）；
 * - 行内引用角标 [n] 渲染为上标链接，点击触发 onViewCitation(n)；
 * - 消息间距 24px；新消息 200ms fade-in（reduce 时直切）。
 */
export const ChatStream = ({
  messages,
  status,
  error,
  onViewCitation,
  onRetry,
  retryDisabled = false,
  className,
}: ChatStreamProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const streaming = isStreamingStatus(status);

  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;
  const lastMessage = messages[messages.length - 1];
  const lastTextLength = lastMessage?.parts.reduce((sum, part) => sum + part.text.length, 0) ?? 0;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !stickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [messages.length, lastTextLength, status]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distance < 120;
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
    >
      {messages.length === 0 ? (
        <div className="app-empty-state rounded-xl px-6 py-12 text-center text-sm">
          向识海提出一个学习问题，回答将以流式文档呈现，引用角标可点击在右侧查看。
        </div>
      ) : (
        <div className="chat-stream-list" role="log" aria-live="polite" aria-busy={streaming}>
          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="chat-stream-block-enter flex justify-end">
                <div className="chat-stream-user bg-primary text-primary-foreground shadow-primary/20 shadow-md">
                  {message.parts.map((part, index) => (
                    <span key={index} className="chat-stream-block">
                      {part.text}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div key={message.id} className="chat-stream-block-enter flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium tracking-wide">
                  识海 · 学习问答
                </span>
                <div className="chat-stream-answer text-foreground">
                  {/* SSE 分片边界可能拆开 [n]，引用按拼接后的完整文本识别。 */}
                  <span className="chat-stream-block">
                    {renderTextWithCitations(
                      message.parts.map((part) => part.text).join(""),
                      message.id,
                      onViewCitation,
                    )}
                    {message.id === lastAssistantId && streaming ? (
                      <span className="chat-stream-caret" aria-hidden />
                    ) : null}
                  </span>
                </div>
              </div>
            ),
          )}

          {status === "reconnecting" ? (
            <p className="text-muted-foreground flex items-center gap-2 text-xs" role="status">
              <span className="chat-stream-reconnect-dot" aria-hidden />
              连接中断，正在重连并按消息去重续流……
            </p>
          ) : null}

          {streaming ? <span className="sr-only">正在作答</span> : null}
        </div>
      )}

      {error ? (
        <div
          className="app-danger-surface mt-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm"
          role="alert"
        >
          <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{error}</span>
          {onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={retryDisabled}
              onClick={onRetry}
            >
              <RotateCcwIcon aria-hidden />
              重试
            </Button>
          ) : null}
        </div>
      ) : null}

      <div ref={bottomRef} aria-hidden />
    </div>
  );
};
