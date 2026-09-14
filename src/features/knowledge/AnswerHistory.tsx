"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";

import { EmptyState, Notice, SeaLink } from "@/features/sea/components/primitives";
import { getAuthToken } from "@/services/auth";

import {
  appendAcceptedPage,
  type HistoricalAnswer,
  readCurrentCitationStates,
  readHistoricalAnswer,
} from "./answer-history";
import {
  type AcceptedAnswer,
  knowledgeAnswerHistory,
  type ProductAnswerCitationStates,
} from "./api";
import { ProductSearchForm } from "./ProductSearchForm";

import "./knowledge.css";

const subscribeSession = (change: () => void) => {
  window.addEventListener("sea-session-change", change);
  window.addEventListener("storage", change);
  return () => {
    window.removeEventListener("sea-session-change", change);
    window.removeEventListener("storage", change);
  };
};

export function AnswerHistoryEntry({ moduleId = "" }: { moduleId?: string }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const moduleQuery = moduleId ? `?module_id=${encodeURIComponent(moduleId)}` : "";
  return (
    <div className="sea-content knowledge-answer-history">
      <SeaLink href="/knowledge">← 返回知识书架</SeaLink>
      <div className="sea-page-heading">
        <div>
          <span className="sea-eyebrow">ACCEPTED ANSWERS</span>
          <h1>知识问答</h1>
          <p>新建知识问答会话，或继续查看已有会话中已正式接纳的答案。</p>
        </div>
      </div>
      <form
        className="knowledge-answer-entry"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const id = sessionId.trim();
          if (id) router.push(`/knowledge/answer-sessions/${encodeURIComponent(id)}${moduleQuery}`);
        }}
      >
        <label htmlFor="knowledge-answer-session">知识问答会话 ID</label>
        <div>
          <input
            id="knowledge-answer-session"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            autoComplete="off"
            required
          />
          <button className="sea-button" type="submit">
            进入会话
          </button>
        </div>
      </form>
      <button
        className="sea-button"
        onClick={() =>
          router.push(`/knowledge/answer-sessions/session_${crypto.randomUUID()}${moduleQuery}`)
        }
      >
        新建知识问答会话
      </button>
      <Notice>当前学习对话尚未提供与知识问答会话的关联入口。已有会话请使用原会话 ID。</Notice>
    </div>
  );
}

function AnswerCard({
  answer,
  sessionId,
  currentStates,
  detail,
}: {
  answer: HistoricalAnswer;
  sessionId: string;
  currentStates?: Map<string, "available" | "unavailable">;
  detail: boolean;
}) {
  return (
    <article className="knowledge-answer-card">
      <div className="knowledge-answer-meta">
        <span className="sea-pill">第 {answer.ordinal} 条已接纳记录</span>
        <span>{answer.status === "succeeded" ? "已完成" : "证据不足"}</span>
        <time dateTime={answer.acceptedAt}>
          {answer.acceptedAt
            ? new Date(answer.acceptedAt).toLocaleString("zh-CN")
            : "接纳时间未提供"}
        </time>
      </div>
      <h2>{answer.question}</h2>
      {answer.status === "succeeded" ? (
        <p className="knowledge-body">{answer.answer}</p>
      ) : (
        <p>这次搜索没有足够的已接纳证据，因此没有生成答案。</p>
      )}
      {answer.citations.length > 0 && (
        <section className="knowledge-answer-citations" aria-label="历史引用">
          <h3>当时接纳的引用</h3>
          {!currentStates ? (
            <p>
              {answer.citations.length} 条历史引用。
              {detail ? "当前可用性暂不能核实。" : "进入固定记录后核对当前可用性。"}
            </p>
          ) : (
            <ol>
              {answer.citations.map((citation) => {
                const available = currentStates.get(citation.id) === "available";
                return (
                  <li key={citation.id}>
                    <strong>{available ? "当前可用" : "已撤回或不可用"}</strong>
                    <small>
                      证据 {citation.id} · {citation.location || "定位未提供"}
                    </small>
                    {available && (
                      <>
                        <p className="knowledge-body">
                          接纳时摘录：{citation.quote || "原文摘录未提供"}
                        </p>
                        {citation.sourceHref && (
                          <SeaLink href={citation.sourceHref}>打开固定修订 →</SeaLink>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
      <SeaLink
        className="sea-text-link"
        href={`/knowledge/answer-sessions/${encodeURIComponent(sessionId)}/${encodeURIComponent(answer.answerId)}`}
      >
        查看这条记录的固定链接 →
      </SeaLink>
    </article>
  );
}

export function AnswerHistory({
  sessionId,
  answerId = "",
  moduleId = "",
}: {
  sessionId: string;
  answerId?: string;
  moduleId?: string;
}) {
  const token = useSyncExternalStore(subscribeSession, getAuthToken, () => null);
  if (!token)
    return (
      <div className="sea-content knowledge-answer-history">
        <SeaLink href="/knowledge/answer-sessions">← 返回问答历史</SeaLink>
        <EmptyState title="请先登录">
          历史答案仅对当前账号开放。<SeaLink href="/login">前往登录 →</SeaLink>
        </EmptyState>
      </div>
    );
  return (
    <AuthorizedAnswerHistory
      key={`${token}/${sessionId}/${answerId}`}
      sessionId={sessionId}
      answerId={answerId}
      token={token}
      moduleId={moduleId}
    />
  );
}

function AuthorizedAnswerHistory({
  sessionId,
  answerId,
  token,
  moduleId,
}: {
  sessionId: string;
  answerId: string;
  token: string;
  moduleId: string;
}) {
  const [items, setItems] = useState<AcceptedAnswer[]>([]);
  const [single, setSingle] = useState<AcceptedAnswer | null>(null);
  const [citationStates, setCitationStates] = useState<ProductAnswerCitationStates | null>(null);
  const [citationError, setCitationError] = useState("");
  const [next, setNext] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const call = answerId
      ? knowledgeAnswerHistory
          .answer(sessionId, answerId, controller.signal)
          .then(async (answer) => {
            if (controller.signal.aborted) return;
            setSingle(answer);
            try {
              const states = await knowledgeAnswerHistory.citationStates(
                sessionId,
                answerId,
                controller.signal,
              );
              if (!controller.signal.aborted) {
                setCitationStates(states);
                setCitationError("");
              }
            } catch (cause) {
              if (!controller.signal.aborted)
                setCitationError(cause instanceof Error ? cause.message : "无法核对引用可用性。");
            }
          })
      : knowledgeAnswerHistory.list(sessionId, cursor, controller.signal).then((page) => {
          if (controller.signal.aborted) return;
          setItems((existing) => appendAcceptedPage(cursor ? existing : [], page));
          setNext(page.next_ordinal && page.next_ordinal > cursor ? page.next_ordinal : 0);
        });
    call
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "读取历史答案失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [answerId, cursor, retry, sessionId]);

  let parsed: HistoricalAnswer[] = [];
  let presentationError = error;
  if (!presentationError) {
    try {
      parsed = (answerId ? (single ? [single] : []) : items).map((item) =>
        readHistoricalAnswer(item, sessionId),
      );
    } catch (cause) {
      presentationError = cause instanceof Error ? cause.message : "历史答案格式不正确。";
    }
  }
  let verifiedStates: Map<string, "available" | "unavailable"> | undefined;
  let citationPresentationError = citationError;
  if (answerId && parsed[0] && citationStates && !citationPresentationError) {
    try {
      verifiedStates = readCurrentCitationStates(parsed[0], citationStates);
    } catch (cause) {
      citationPresentationError = cause instanceof Error ? cause.message : "引用状态无效。";
    }
  }
  return (
    <div className="sea-content knowledge-answer-history">
      <div className="sea-breadcrumb">
        <SeaLink href="/knowledge">知识书架</SeaLink>
        <span>/</span>
        <SeaLink href="/knowledge/answer-sessions">问答历史</SeaLink>
        <span>/</span>
        {answerId ? (
          <SeaLink href={`/knowledge/answer-sessions/${encodeURIComponent(sessionId)}`}>
            本会话
          </SeaLink>
        ) : (
          "本会话"
        )}
      </div>
      <div className="sea-page-heading">
        <div>
          <span className="sea-eyebrow">ACCEPTED ANSWERS</span>
          <h1>{answerId ? "已接纳答案" : "本会话的已接纳答案"}</h1>
          <p className="knowledge-id">会话：{sessionId}</p>
        </div>
      </div>
      {!answerId && <ProductSearchForm sessionId={sessionId} token={token} moduleId={moduleId} />}
      <Notice>
        这里保存的是当时已接纳的答案。来源撤回后，历史答案仍保留；请以详情页的当前引用状态判断来源是否仍可读。
      </Notice>
      {presentationError && (
        <Notice error>
          {presentationError}{" "}
          <button
            onClick={() => {
              setLoading(true);
              setError("");
              setRetry((value) => value + 1);
            }}
          >
            重新读取
          </button>
        </Notice>
      )}
      {loading && <p role="status">正在读取已接纳的历史…</p>}
      {answerId && parsed[0]?.citations.length > 0 && !verifiedStates && !loading && (
        <Notice error>
          当前引用可用性未核实：{citationPresentationError || "请稍后重试。"}{" "}
          <button
            onClick={() => {
              setLoading(true);
              setCitationError("");
              setCitationStates(null);
              setRetry((value) => value + 1);
            }}
          >
            重新核对
          </button>
        </Notice>
      )}
      {!loading && !presentationError && parsed.length === 0 && (
        <EmptyState title={answerId ? "这条记录不可读" : "本会话暂无已接纳答案"}>
          {answerId
            ? "请核对固定链接或返回本会话。"
            : "只有通过答案与引用校验后正式接纳的记录才会出现在这里。"}
        </EmptyState>
      )}
      {!presentationError &&
        parsed.map((answer) => (
          <AnswerCard
            key={answer.answerId}
            answer={answer}
            sessionId={sessionId}
            currentStates={answerId ? verifiedStates : undefined}
            detail={Boolean(answerId)}
          />
        ))}
      {!answerId && next > 0 && !loading && !presentationError && (
        <button
          className="sea-button"
          onClick={() => {
            setLoading(true);
            setCursor(next);
          }}
        >
          加载后续记录
        </button>
      )}
    </div>
  );
}
