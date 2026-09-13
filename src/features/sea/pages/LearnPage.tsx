"use client";
import { useEffect, useRef, useState } from "react";

import {
  ArrowRight,
  BookOpen,
  History,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Square,
  X,
} from "../components/icons";
import { Notice, SeaLink } from "../components/primitives";
import { useSea } from "../components/SeaShell";
import { citationPath, seaRequest, streamAnswer } from "../data/api";
import { citations } from "../data/demo";
import type { AnswerStatus, Conversation, Message } from "../data/types";
const initialMessages: Message[] = [
  { id: "demo-u1", role: "user", content: "为什么同一座山的两侧，会长着不一样的森林？" },
  {
    id: "demo-a1",
    role: "assistant",
    content:
      "一座山，可以把空气带进两种不同的旅程。\n\n迎风坡的湿润空气沿着山体上升，冷却、凝结，更容易形成云和降水。翻过山脊后，空气下沉并逐渐变暖，背风坡通常相对干燥。\n\n因此，水分差异会影响树木的生长与分布。但森林的变化不只由雨影效应决定，海拔、坡向、土壤与季节也同样重要。我们需要结合具体山地的观测资料来理解。",
    status: "complete",
    citations,
  },
];
const statusLabels: Record<AnswerStatus, string> = {
  streaming: "正在回答",
  complete: "回答完成",
  partial: "部分结果 · 保留已取得的证据",
  insufficient_evidence: "证据不足",
  failed: "生成失败 · 已保留内容",
  cancelled: "已停止 · 保留部分内容",
};
export function LearnPage() {
  const { demo } = useSea();
  const [messages, setMessages] = useState<Message[]>(demo ? initialMessages : []);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState(demo ? "demo-conversation-1" : "");
  const [history, setHistory] = useState<Conversation[]>(
    demo
      ? [{ id: "demo-conversation-1", title: "山的两侧，森林为何不同", messages: initialMessages }]
      : [],
  );
  const [selectedCitation, setSelectedCitation] = useState("1");
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyToggle = useRef<HTMLButtonElement>(null);
  const pendingSend = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const answerId = useRef<string | null>(null);
  const localAnswerId = useRef<string | null>(null);
  const generation = useRef(0);
  const terminalGeneration = useRef<number | null>(null);
  const lastQuestion = useRef("");
  const bottom = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const pendingDelta = useRef("");
  useEffect(
    () => () => {
      controller.current?.abort();
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );
  useEffect(() => {
    if (!demo) {
      const c = new AbortController();
      seaRequest<{ items: Conversation[] }>("learning/conversations?limit=30", { signal: c.signal })
        .then((r) => setHistory(r.items))
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        });
      return () => c.abort();
    }
  }, [demo]);
  const patch = (id: string, update: Partial<Message>) =>
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...update } : m)));
  const flushDelta = () => {
    const text = pendingDelta.current;
    const targetId = localAnswerId.current;
    pendingDelta.current = "";
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (text)
      setMessages((list) =>
        list.map((m) => (m.id === targetId ? { ...m, content: m.content + text } : m)),
      );
    raf.current = null;
  };
  async function send(override?: string) {
    const text = (override ?? question).trim();
    if (!text || pendingSend.current) return;
    pendingSend.current = true;
    const version = ++generation.current;
    terminalGeneration.current = null;
    const c = new AbortController();
    controller.current = c;
    lastQuestion.current = text;
    setError("");
    setBusy(true);
    setQuestion("");
    const uid = crypto.randomUUID();
    const aid = crypto.randomUUID();
    localAnswerId.current = aid;
    answerId.current = null;
    setMessages((list) => [
      ...list,
      { id: uid, role: "user", content: text },
      { id: aid, role: "assistant", content: "", status: "streaming", citations: [] },
    ]);
    try {
      if (demo) {
        const answer =
          "从资料里，我们可以先抓住两个线索：水分从哪里来，空气沿着什么路径移动。\n\n迎风坡更容易获得降水，背风坡相对干燥；但具体森林类型还需要结合海拔、坡向和长期观测判断。你可以打开右侧引用，继续阅读原始段落。";
        for (let i = 0; i < answer.length; i += 7) {
          if (c.signal.aborted) break;
          await new Promise((r) => setTimeout(r, 35));
          if (!c.signal.aborted) patch(aid, { content: answer.slice(0, i + 7) });
        }
        if (!c.signal.aborted) {
          terminalGeneration.current = version;
          patch(aid, { status: "complete", citations });
        }
      } else {
        let id = conversationId;
        if (!id) {
          const created = await seaRequest<{ conversation_id: string }>("learning/conversations", {
            method: "POST",
            signal: c.signal,
            body: JSON.stringify({ title: text.slice(0, 40) }),
          });
          id = created.conversation_id;
          setConversationId(id);
        }
        await streamAnswer(id, text, uid, c.signal, (event) => {
          if (
            generation.current !== version ||
            c.signal.aborted ||
            terminalGeneration.current === version
          )
            return;
          if (event.answer_id) answerId.current = event.answer_id;
          if (event.type === "answer.delta" && event.delta) {
            pendingDelta.current += event.delta;
            if (!raf.current) raf.current = requestAnimationFrame(flushDelta);
          }
          if (event.type === "answer.citation" && event.citation) {
            const citation = event.citation;
            setMessages((list) =>
              list.map((m) =>
                m.id === aid ? { ...m, citations: [...(m.citations ?? []), citation] } : m,
              ),
            );
          }
          if (event.type === "answer.completed") {
            flushDelta();
            terminalGeneration.current = version;
            patch(aid, { status: event.status ?? "complete" });
          }
          if (event.type === "answer.failed") {
            flushDelta();
            terminalGeneration.current = version;
            patch(aid, { status: "failed" });
            setError(event.message ?? "生成失败，已有内容保留");
          }
        });
        if (terminalGeneration.current !== version && !c.signal.aborted) {
          flushDelta();
          patch(aid, { status: "partial" });
          setError("连接结束但尚未收到终态。不会自动重新生成；可手动查询回答状态。");
        }
      }
    } catch (e) {
      // A received business terminal wins over errors while draining the response to EOF.
      if (generation.current !== version || terminalGeneration.current === version) return;
      flushDelta();
      patch(aid, { status: c.signal.aborted ? "cancelled" : "failed" });
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      if (generation.current === version) {
        setBusy(false);
        pendingSend.current = false;
      }
    }
  }
  async function stop() {
    const stoppedGeneration = generation.current;
    controller.current?.abort();
    // The answer is already terminal; stopping now only closes the remaining transport.
    if (terminalGeneration.current === stoppedGeneration) return;
    flushDelta();
    if (localAnswerId.current) patch(localAnswerId.current, { status: "cancelled" });
    if (!demo && answerId.current) {
      try {
        await seaRequest(`learning/answers/${encodeURIComponent(answerId.current)}/cancel`, {
          method: "POST",
          body: JSON.stringify({ reason: "user_cancelled" }),
        });
      } catch {
        if (generation.current === stoppedGeneration)
          setError("本地已停止接收；服务端取消确认失败，可重试取消。");
      }
    } else if (!demo) setError("本地已停止；尚未取得 answer_id，需由服务端请求中断传播完成取消。");
  }
  async function recover() {
    if (!answerId.current || pendingSend.current) return;
    const remote = answerId.current;
    const local = localAnswerId.current;
    const gen = generation.current;
    try {
      const answer = await seaRequest<Message>(`learning/answers/${encodeURIComponent(remote)}`);
      if (
        generation.current !== gen ||
        answerId.current !== remote ||
        localAnswerId.current !== local
      )
        return;
      if (local) patch(local, { ...answer, id: local });
      setError("");
    } catch (e) {
      if (generation.current === gen) setError(e instanceof Error ? e.message : "查询失败");
    }
  }
  function closeHistory() {
    setHistoryOpen(false);
    if (historyOpen) historyToggle.current?.focus();
  }
  function newConversation() {
    if (pendingSend.current) return;
    generation.current++;
    terminalGeneration.current = null;
    answerId.current = null;
    localAnswerId.current = null;
    if (messages.length) {
      setHistory((h) =>
        [
          {
            id: conversationId || crypto.randomUUID(),
            title: messages.find((m) => m.role === "user")?.content.slice(0, 30) || "新的对话",
            messages,
          },
          ...h.filter((c) => c.id !== conversationId),
        ].slice(0, 30),
      );
    }
    setMessages([]);
    setConversationId("");
    setError("");
    closeHistory();
  }
  const answer = messages.filter((m) => m.role === "assistant").at(-1);
  const sources = answer?.citations ?? [];
  return (
    <div
      className="sea-chat-layout"
      onKeyDown={(event) => {
        if (event.key === "Escape" && historyOpen) {
          event.preventDefault();
          closeHistory();
        }
      }}
    >
      <div className="sea-mobile-history-controls">
        <button
          ref={historyToggle}
          className="sea-button"
          aria-controls="sea-chat-history"
          aria-expanded={historyOpen}
          onClick={() => {
            if (historyOpen) closeHistory();
            else setHistoryOpen(true);
          }}
        >
          <History size={16} />
          {historyOpen ? "收起对话历史" : "新对话与历史"}
        </button>
      </div>
      <aside
        id="sea-chat-history"
        className={historyOpen ? "sea-chat-history open" : "sea-chat-history"}
        aria-label="对话历史"
      >
        <div className="sea-mobile-history-heading">
          <strong>对话历史</strong>
          <button className="sea-icon-button" aria-label="关闭对话历史" onClick={closeHistory}>
            <X size={18} />
          </button>
        </div>
        <div className="sea-eyebrow">LEARN WITH SEA</div>
        <h2>
          每一个问题，
          <br />
          都有新的方向。
        </h2>
        <button className="sea-button primary" onClick={newConversation} disabled={busy}>
          <Plus size={17} />
          开启新的对话
        </button>
        <div className="sea-history-label">
          <History size={14} />
          最近的探索
        </div>
        {history.map((h) => (
          <button
            key={h.id}
            className={h.id === conversationId ? "active" : ""}
            disabled={busy}
            onClick={() => {
              generation.current++;
              terminalGeneration.current = null;
              answerId.current = null;
              localAnswerId.current = null;
              setConversationId(h.id);
              setMessages(h.messages);
              setError("");
              closeHistory();
            }}
          >
            <MessageCircle size={15} />
            {h.title}
          </button>
        ))}
        <div className="sea-chat-history-bottom">
          <img src="/sea/whale.svg" alt="WhaleHall 鲸鱼陪伴" width="80" height="70" />
          <p>
            慢慢问，慢慢懂。
            <br />
            Sea 会陪你把线索连起来。
          </p>
          <SeaLink href="/knowledge">
            去知识书架走走 <ArrowRight size={14} />
          </SeaLink>
        </div>
      </aside>
      <section className="sea-chat">
        <div className="sea-chat-top">
          <div>
            <Sparkles size={20} />
            <strong>学习对话</strong>
            <span>有证据的思考，有来处的回答</span>
          </div>
          <SeaLink href="/search">
            搜索
            <ArrowRight size={14} />
          </SeaLink>
        </div>
        <div className="sea-message-list">
          {messages.length === 0 && (
            <div className="sea-chat-empty">
              <Sparkles size={36} />
              <h1>今天，想读懂什么？</h1>
              <p>从正式知识与已发布文章中寻找线索。</p>
              {["山地如何改变气候？", "怎样开始观察夏季星空？", "如何把阅读笔记连成知识？"].map(
                (q) => (
                  <button key={q} onClick={() => setQuestion(q)}>
                    {q}
                    <ArrowRight size={16} />
                  </button>
                ),
              )}
            </div>
          )}
          {messages.map((m) => (
            <article key={m.id} className={`sea-message ${m.role}`}>
              <div className="sea-message-author">
                {m.role === "assistant" ? (
                  <>
                    <span className="sea-ai-avatar">
                      <Sparkles size={17} />
                    </span>
                    <strong>Sea</strong>
                    <span>陪你一起理解</span>
                  </>
                ) : (
                  <>
                    <span className="sea-avatar">{demo ? "林" : "我"}</span>
                    <strong>你</strong>
                  </>
                )}
              </div>
              <div className="sea-message-content">
                {m.content.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {m.role === "assistant" && m.status === "streaming" && (
                  <span className="sea-stream-cursor" />
                )}
              </div>
              {m.citations?.length ? (
                <div className="sea-message-cites">
                  {m.citations.map((c) => (
                    <button key={c.id} onClick={() => setSelectedCitation(c.id)}>
                      <span>{c.id}</span>
                      {c.title}
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              ) : null}
              {m.status && (
                <div className="sea-message-status">
                  {demo ? "演示 · " : ""}
                  {statusLabels[m.status]}
                  {m.status === "insufficient_evidence" && (
                    <p>当前正式资料不足以回答这个问题。可以缩小范围；不会默认联网补写。</p>
                  )}
                </div>
              )}
            </article>
          ))}
          {error && (
            <Notice error>
              {error}
              <div>
                <button onClick={() => send(lastQuestion.current)} disabled={busy}>
                  明确重新生成
                </button>
                {answerId.current && (
                  <>
                    <button onClick={recover} disabled={busy}>
                      查询已有回答状态
                    </button>
                    <button onClick={stop}>重试取消已有回答</button>
                  </>
                )}
              </div>
            </Notice>
          )}
          <div ref={bottom} />
        </div>
        <div className="sea-composer-wrap">
          {demo && answer && (
            <label className="sea-demo-status-control">
              演示状态
              <select
                value={answer.status}
                onChange={(e) =>
                  patch(answer.id, {
                    status: e.target.value as AnswerStatus,
                    ...(e.target.value === "insufficient_evidence"
                      ? {
                          content:
                            "当前正式资料不足以支持回答。请缩小问题范围，或等待新的资料发布。",
                          citations: [],
                        }
                      : {}),
                  })
                }
              >
                <option value="complete">完整回答</option>
                <option value="partial">部分结果</option>
                <option value="insufficient_evidence">无证据</option>
                <option value="failed">失败恢复</option>
                <option value="cancelled">已停止</option>
              </select>
            </label>
          )}
          <form
            className="sea-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              aria-label="学习问题"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="继续追问，或换一个好奇的方向…"
              rows={2}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div>
              <span>
                <BookOpen size={14} />
                全站正式知识 + 已发布文章
              </span>
              {busy ? (
                <button className="sea-button" type="button" onClick={stop}>
                  <Square size={13} />
                  停止
                </button>
              ) : (
                <button className="sea-send" disabled={!question.trim()} aria-label="发送问题">
                  <Send size={18} />
                </button>
              )}
            </div>
          </form>
          <p className="sea-composer-note">
            回答应结合来源理解 · ⌘ / Ctrl + Enter 发送 · 评论不作为问答证据
          </p>
        </div>
      </section>
      <aside className="sea-chat-sources">
        <span className="sea-eyebrow">SOURCES & CONTEXT</span>
        <h3>沿着来源，读得更深。</h3>
        <p>本次回答使用的固定版本</p>
        {sources.map((c) => (
          <div
            key={c.id}
            className={`sea-citation-card ${selectedCitation === c.id ? "selected" : ""}`}
          >
            <div>
              <span className="sea-citation">{c.id}</span>
              <small>
                {c.kind === "wiki"
                  ? "Wiki 知识页"
                  : c.kind === "article"
                    ? "已发布文章"
                    : "原始资料"}
              </small>
            </div>
            <h4>{c.title}</h4>
            <p>
              {c.release} · {c.locator}
            </p>
            <blockquote>{c.excerpt}</blockquote>
            {citationPath(c) ? (
              <SeaLink href={citationPath(c)!}>
                打开具体段落
                <ArrowRight size={14} />
              </SeaLink>
            ) : (
              <span className="sea-muted sea-small">修订定位待接入</span>
            )}
          </div>
        ))}
        {!sources.length && (
          <div className="sea-note-card">
            <h4>暂无可用引用</h4>
            <p>等待真实证据返回；没有引用时不展示虚构来源。</p>
          </div>
        )}
        <div className="sea-note-card">
          <strong>理解，可以再向前一步</strong>
          <p>先看原文，再看解释。你可以随时回到资料所在的具体修订。</p>
        </div>
      </aside>
    </div>
  );
}
