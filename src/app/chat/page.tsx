"use client";

import { BookOpenCheckIcon, SendIcon, SquareIcon } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useMemo, useRef, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import {
  type ChatSendPayload,
  collectCitationNumbers,
  useChatStream,
} from "@/features/knowledge/chat-stream";
import { ChatStream } from "@/features/knowledge/ChatStream";
import { ChatTierSelector } from "@/features/knowledge/ChatTierSelector";
import type { ChatTier } from "@/features/knowledge/generated/structureComponents";
import { cn } from "@/lib/utils";

/** 默认档：D12 冻结值待产品下发，暂取 balanced（规划+精排）。 */
const DEFAULT_CHAT_TIER: ChatTier = "balanced";

export default function ChatPage() {
  const [tier, setTier] = useState<ChatTier>(DEFAULT_CHAT_TIER);
  const [question, setQuestion] = useState("");
  const [selectedCitation, setSelectedCitation] = useState<number | null>(null);
  const lastPayloadRef = useRef<ChatSendPayload | null>(null);
  const { messages, status, error, send, stop } = useChatStream();
  const citations = useMemo(() => collectCitationNumbers(messages), [messages]);
  const busy = status === "streaming" || status === "reconnecting";

  const submit = (payload: ChatSendPayload) => {
    lastPayloadRef.current = payload;
    setSelectedCitation(null);
    void send(payload);
    setQuestion("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    submit({ question: trimmed, tier });
  };

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const trimmed = question.trim();
      if (trimmed && !busy) submit({ question: trimmed, tier });
    }
  };

  return (
    <Layout>
      <PageContainer className="py-6 sm:py-8">
        <header className="mb-5 space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">学习问答</h1>
          <p className="text-muted-foreground text-sm">
            选择检索深度后提问，回答以流式文档呈现；行内引用角标
            <sup className="text-primary font-semibold">[n]</sup> 可点击在右侧查看。
          </p>
        </header>

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section
            className="app-surface flex h-[calc(100dvh-15rem)] min-h-[30rem] flex-col gap-4 rounded-2xl p-4 sm:p-5"
            aria-label="学习问答会话"
          >
            <ChatTierSelector
              value={tier}
              onValueChange={(next) => setTier(next)}
              disabled={busy}
            />

            <ChatStream
              messages={messages}
              status={status}
              error={error}
              onViewCitation={setSelectedCitation}
              onRetry={() => {
                const payload = lastPayloadRef.current;
                if (payload) void send(payload);
              }}
              retryDisabled={busy}
            />

            <form onSubmit={handleSubmit} className="border-border/70 flex gap-2 border-t pt-4">
              <label className="sr-only" htmlFor="chat-question">
                学习问题
              </label>
              <textarea
                id="chat-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="输入学习问题……（Enter 发送，Shift+Enter 换行）"
                rows={2}
                disabled={busy}
                className="focus-visible:ring-ring min-h-[3.25rem] flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2"
              />
              {busy ? (
                <Button type="button" variant="outline" onClick={stop} aria-label="停止生成">
                  <SquareIcon aria-hidden />
                  停止
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!question.trim()}
                  aria-label="发送问题"
                  className="rounded-xl"
                >
                  <SendIcon aria-hidden />
                  发送
                </Button>
              )}
            </form>
          </section>

          <aside
            className="app-surface-muted rounded-2xl p-4 lg:sticky lg:top-6"
            aria-label="引用侧栏"
            aria-live="polite"
          >
            <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
              <BookOpenCheckIcon className="h-3.5 w-3.5" aria-hidden />
              引用
            </h2>
            {citations.length === 0 ? (
              <p className="text-muted-foreground/90 mt-3 text-xs leading-5">
                回答尚未携带引用。生成包含 [n] 角标的回答后，对应 CitationCard / EvidencePanel
                证据卡将在此展示。
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {citations.map((n) => (
                  <li
                    key={n}
                    className={cn(
                      "border-border/70 bg-card/60 rounded-xl border px-3 py-2.5 text-xs",
                      "motion-safe:transition-colors motion-safe:duration-200",
                      n === selectedCitation && "border-primary/60 bg-primary/10",
                    )}
                    data-citation-slot={n}
                    aria-current={n === selectedCitation ? "true" : undefined}
                  >
                    <span className="text-primary font-mono font-semibold">[{n}]</span>
                    <span className="text-muted-foreground ml-2">
                      占位：doc 标题、revision 徽标、section 面包屑与 quote 高亮 将由 CitationCard
                      渲染；lane 分数由 EvidencePanel 展开。
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {selectedCitation !== null ? (
              <p className="text-foreground/80 mt-3 text-xs">
                已选中引用 <span className="font-mono font-semibold">[{selectedCitation}]</span>
                ，等待引用详情接口接入。
              </p>
            ) : null}
          </aside>
        </div>
      </PageContainer>
    </Layout>
  );
}
