"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_FRONTEND_SESSION_MESSAGE,
  getFrontendAccessState,
} from "@/services/auth";
import {
  getConversationMessages,
  getUnreadSummary,
  listConversations,
  listNotifications,
  markAllNotificationsRead,
  markConversationRead,
  markNotificationRead,
  sendUserChatMessage,
  type ChatMessageItem,
  type ConversationItem,
  type ConversationMessagesResult,
  type NotificationItem,
  type UnreadSummaryResult,
} from "@/services/message";

const NOTIFICATION_LIMIT = 20;
const CONVERSATION_LIMIT = 20;
const MESSAGE_LIMIT = 50;

const formatTime = (unixSeconds: number): string => {
  if (!unixSeconds) {
    return "--";
  }
  return new Date(unixSeconds * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
};

const notificationKindLabel = (kind: number): string => {
  switch (kind) {
    case 1:
      return "全服公告";
    case 2:
      return "管理员通知";
    case 3:
      return "文章评论";
    case 4:
      return "评论回复";
    case 5:
      return "文章发布";
    case 6:
      return "文章点赞";
    default:
      return `通知类型 ${kind}`;
  }
};

const conversationStatusLabel = (status: number): string => {
  switch (status) {
    case 1:
      return "待回复";
    case 2:
      return "可自由聊天";
    default:
      return "未知状态";
  }
};

export default function MessagesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [summary, setSummary] = useState<UnreadSummaryResult>({
    notification_unread: 0,
    conversation_unread: 0,
    total_unread: 0,
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>("");
  const [conversationDetail, setConversationDetail] = useState<ConversationMessagesResult | null>(null);

  const [draft, setDraft] = useState("");
  const [newChatTargetId, setNewChatTargetId] = useState("");
  const [newChatContent, setNewChatContent] = useState("");

  useEffect(() => {
    const { hasFrontendAccess, userToken } = getFrontendAccessState();
    if (!hasFrontendAccess) {
      router.replace("/login?next=/messages");
      return;
    }

    if (!userToken) {
      setErrorMessage(ADMIN_FRONTEND_SESSION_MESSAGE);
      setIsBootstrapping(false);
      return;
    }

    setToken(userToken);
    setErrorMessage(null);
  }, [router]);

  const loadOverview = async (
    currentToken: string,
    options?: { nextSelectedConversationId?: string; preserveSelection?: boolean },
  ): Promise<void> => {
    const preserveSelection = options?.preserveSelection ?? true;
    const nextSelectedConversationId = options?.nextSelectedConversationId ?? selectedConversationId;

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const [summaryResult, notificationResult, conversationResult] = await Promise.all([
        getUnreadSummary(currentToken),
        listNotifications(currentToken, { offset: 0, limit: NOTIFICATION_LIMIT }),
        listConversations(currentToken, { offset: 0, limit: CONVERSATION_LIMIT }),
      ]);

      setSummary(summaryResult);
      setNotifications(Array.isArray(notificationResult.items) ? notificationResult.items : []);
      const nextConversations = Array.isArray(conversationResult.items) ? conversationResult.items : [];
      setConversations(nextConversations);

      if (nextConversations.length === 0) {
        setSelectedConversationId("");
        setConversationDetail(null);
      } else if (
        preserveSelection &&
        nextSelectedConversationId &&
        nextConversations.some((item) => item.conversation_id === nextSelectedConversationId)
      ) {
        setSelectedConversationId(nextSelectedConversationId);
      } else {
        setSelectedConversationId(nextConversations[0]?.conversation_id ?? "");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "消息中心加载失败");
    } finally {
      setIsRefreshing(false);
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadOverview(token, { preserveSelection: false });
  }, [token]);

  useEffect(() => {
    if (!token || !selectedConversationId) {
      setConversationDetail(null);
      return;
    }

    const activeConversation = conversations.find(
      (item) => item.conversation_id === selectedConversationId,
    );

    const loadDetail = async () => {
      try {
        const detail = await getConversationMessages(token, {
          conversation_id: selectedConversationId,
          offset: 0,
          limit: MESSAGE_LIMIT,
        });
        setConversationDetail(detail);

        if ((activeConversation?.unread_count ?? 0) > 0) {
          await markConversationRead(token, { conversation_id: selectedConversationId });
          await loadOverview(token, { nextSelectedConversationId: selectedConversationId });
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "会话消息加载失败");
      }
    };

    void loadDetail();
  }, [token, selectedConversationId, conversations]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.conversation_id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const handleRefresh = async (): Promise<void> => {
    if (!token) {
      return;
    }
    await loadOverview(token);
  };

  const handleMarkNotificationRead = async (notificationId: string): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      await markNotificationRead(token, { notification_id: notificationId });
      await loadOverview(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "通知设为已读失败");
    }
  };

  const handleMarkAllRead = async (): Promise<void> => {
    if (!token) {
      return;
    }
    try {
      await markAllNotificationsRead(token);
      await loadOverview(token);
      setSuccessMessage("全部通知已设为已读");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "全部已读失败");
    }
  };

  const handleSendInConversation = async (): Promise<void> => {
    if (!token || !selectedConversationId || !draft.trim()) {
      return;
    }
    setIsSending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await sendUserChatMessage(token, {
        conversation_id: selectedConversationId,
        content: draft.trim(),
      });
      setDraft("");
      await loadOverview(token, { nextSelectedConversationId: result.conversation_id });
      const detail = await getConversationMessages(token, {
        conversation_id: result.conversation_id,
        offset: 0,
        limit: MESSAGE_LIMIT,
      });
      setConversationDetail(detail);
      setSuccessMessage(result.can_send ? "消息已发送" : "消息已发送，等待对方回复");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "发送消息失败");
    } finally {
      setIsSending(false);
    }
  };

  const handleStartConversation = async (): Promise<void> => {
    if (!token || !newChatTargetId.trim() || !newChatContent.trim()) {
      setErrorMessage("请先填写目标用户编号和消息内容");
      return;
    }

    setIsStartingChat(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await sendUserChatMessage(token, {
        recipient_id: newChatTargetId.trim(),
        content: newChatContent.trim(),
      });
      setNewChatTargetId("");
      setNewChatContent("");
      await loadOverview(token, { nextSelectedConversationId: result.conversation_id });
      const detail = await getConversationMessages(token, {
        conversation_id: result.conversation_id,
        offset: 0,
        limit: MESSAGE_LIMIT,
      });
      setConversationDetail(detail);
      setSuccessMessage(result.can_send ? "私信已建立" : "首条私信已发送，等待对方回复");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "发起私信失败");
    } finally {
      setIsStartingChat(false);
    }
  };

  const renderMessageBubble = (message: ChatMessageItem) => {
    const isMine = message.sender_role === 1;
    return (
      <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
            isMine
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground border"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <p className={`mt-2 text-xs ${isMine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <PageContainer className="space-y-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">消息中心</h1>
          <p className="text-muted-foreground text-sm">
            管理系统通知、文章互动提醒，以及窗口式私信对话。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">返回个人中心</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={isRefreshing}>
              {isRefreshing ? "刷新中..." : "刷新消息"}
            </Button>
          </div>
        </header>

        {isBootstrapping ? (
          <p className="text-muted-foreground">加载消息中心中...</p>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>未读总数</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{summary.total_unread}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>通知未读</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{summary.notification_unread}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>私信未读</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{summary.conversation_unread}</p>
                </CardContent>
              </Card>
            </section>

            {(errorMessage || successMessage) && (
              <Card>
                <CardContent className="space-y-2 pt-6">
                  {errorMessage && (
                    <p id="message-feedback-error" data-status="error" className="text-destructive text-sm">
                      {errorMessage}
                    </p>
                  )}
                  {successMessage && (
                    <p id="message-feedback-success" data-status="success" className="text-primary text-sm">
                      {successMessage}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>系统通知</CardTitle>
                    <CardDescription>展示最近 {NOTIFICATION_LIMIT} 条消息提醒。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleMarkAllRead()}
                      disabled={notifications.length === 0}
                    >
                      全部设为已读
                    </Button>

                    <div className="space-y-3">
                      {notifications.length === 0 ? (
                        <p className="text-muted-foreground text-sm">暂无通知</p>
                      ) : (
                        notifications.map((item) => (
                          <div key={item.id} className="rounded-xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="font-medium">{item.title}</p>
                                <p className="text-muted-foreground text-xs">
                                  {notificationKindLabel(item.kind)} · {formatTime(item.created_at)}
                                </p>
                              </div>
                              {!item.is_read && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleMarkNotificationRead(item.id)}
                                >
                                  已读
                                </Button>
                              )}
                            </div>
                            <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>发起新私信</CardTitle>
                    <CardDescription>
                      用户之间首条消息最多 50 字，发送后需等待对方回复才能继续发送。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="message-target-id">目标用户编号</Label>
                      <Input
                        id="message-target-id"
                        value={newChatTargetId}
                        onChange={(event) => setNewChatTargetId(event.target.value)}
                        placeholder="输入想联系的用户编号"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="message-first-content">首条消息</Label>
                      <textarea
                        id="message-first-content"
                        value={newChatContent}
                        onChange={(event) => setNewChatContent(event.target.value)}
                        maxLength={50}
                        rows={4}
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[112px] rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        placeholder="写一段简短问候，50 字以内"
                      />
                      <p className="text-muted-foreground text-xs">{newChatContent.length}/50</p>
                    </div>
                    <Button
                      id="message-start-submit"
                      onClick={() => void handleStartConversation()}
                      disabled={isStartingChat}
                    >
                      {isStartingChat ? "发送中..." : "发送首条私信"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>私信会话</CardTitle>
                    <CardDescription>点击右侧查看完整聊天记录。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {conversations.length === 0 ? (
                      <p className="text-muted-foreground text-sm">暂无会话</p>
                    ) : (
                      conversations.map((item) => (
                        <button
                          key={item.conversation_id}
                          type="button"
                          onClick={() => {
                            setSuccessMessage(null);
                            setSelectedConversationId(item.conversation_id);
                          }}
                          className={`w-full rounded-xl border p-4 text-left transition-colors ${
                            item.conversation_id === selectedConversationId
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">
                                {item.peer_name || `用户 ${item.peer_id}`}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                用户编号 {item.peer_id} · {conversationStatusLabel(item.status)}
                              </p>
                            </div>
                            {item.unread_count > 0 && (
                              <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                                {item.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">
                            {item.latest_message || "暂无消息"}
                          </p>
                          <p className="text-muted-foreground mt-2 text-xs">
                            {formatTime(item.latest_message_at || item.updated_at)}
                          </p>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {selectedConversation
                        ? `与 ${selectedConversation.peer_name || `用户 ${selectedConversation.peer_id}`} 的对话`
                        : "聊天窗口"}
                    </CardTitle>
                    <CardDescription>
                      {selectedConversation
                        ? `${conversationStatusLabel(conversationDetail?.status ?? selectedConversation.status)} · ${
                            (conversationDetail?.can_send ?? selectedConversation.can_send)
                              ? "当前可发送消息"
                              : "等待对方回复后才可继续发送"
                          }`
                        : "选择左侧会话或发起一条新的私信。"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedConversation || !conversationDetail ? (
                      <p className="text-muted-foreground text-sm">请选择一条会话查看详细内容。</p>
                    ) : (
                      <>
                        <div className="bg-muted/30 space-y-3 rounded-xl border p-4">
                          {conversationDetail.items.length === 0 ? (
                            <p className="text-muted-foreground text-sm">暂无历史消息</p>
                          ) : (
                            conversationDetail.items.map(renderMessageBubble)
                          )}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="message-draft">发送消息</Label>
                          <textarea
                            id="message-draft"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            rows={5}
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[136px] rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            placeholder="输入你想发送的内容"
                            disabled={!conversationDetail.can_send || isSending}
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            id="message-send-submit"
                            onClick={() => void handleSendInConversation()}
                            disabled={!conversationDetail.can_send || isSending || !draft.trim()}
                          >
                            {isSending ? "发送中..." : "发送消息"}
                          </Button>
                          {!conversationDetail.can_send && (
                            <p className="text-muted-foreground self-center text-sm">
                              这条会话还在等待对方回复。
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </PageContainer>
    </Layout>
  );
}
