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
import { buildLoginPath } from "@/lib/auth-entry";
import { getAdminAuthToken } from "@/services/admin";
import {
  type ChatMessageItem,
  type ConversationItem,
  type ConversationMessagesResult,
  getAdminConversationMessages,
  listAdminConversations,
  markAdminConversationRead,
  sendAdminChatMessage,
  sendAdminNotification,
} from "@/services/message";

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

export default function AdminMessagesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [broadcast, setBroadcast] = useState(true);
  const [targetUserId, setTargetUserId] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationContent, setNotificationContent] = useState("");
  const [notificationKind, setNotificationKind] = useState("");

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [conversationDetail, setConversationDetail] = useState<ConversationMessagesResult | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [newChatUserId, setNewChatUserId] = useState("");
  const [newChatContent, setNewChatContent] = useState("");

  useEffect(() => {
    const currentToken = getAdminAuthToken();
    if (!currentToken) {
      router.replace(buildLoginPath({ role: "admin", next: "/admin/messages" }));
      return;
    }
    setToken(currentToken);
  }, [router]);

  const loadConversations = async (
    currentToken: string,
    options?: { nextSelectedConversationId?: string; preserveSelection?: boolean },
  ): Promise<void> => {
    const preserveSelection = options?.preserveSelection ?? true;
    const nextSelectedConversationId =
      options?.nextSelectedConversationId ?? selectedConversationId;

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const result = await listAdminConversations(currentToken, {
        offset: 0,
        limit: CONVERSATION_LIMIT,
      });
      const nextItems = Array.isArray(result.items) ? result.items : [];
      setConversations(nextItems);

      if (nextItems.length === 0) {
        setSelectedConversationId("");
        setConversationDetail(null);
      } else if (
        preserveSelection &&
        nextSelectedConversationId &&
        nextItems.some((item) => item.conversation_id === nextSelectedConversationId)
      ) {
        setSelectedConversationId(nextSelectedConversationId);
      } else {
        setSelectedConversationId(nextItems[0]?.conversation_id ?? "");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "会话列表加载失败");
    } finally {
      setIsRefreshing(false);
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadConversations(token, { preserveSelection: false });
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
        const detail = await getAdminConversationMessages(token, {
          conversation_id: selectedConversationId,
          offset: 0,
          limit: MESSAGE_LIMIT,
        });
        setConversationDetail(detail);
        if ((activeConversation?.unread_count ?? 0) > 0) {
          await markAdminConversationRead(token, { conversation_id: selectedConversationId });
          await loadConversations(token, { nextSelectedConversationId: selectedConversationId });
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "聊天内容加载失败");
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
    await loadConversations(token);
  };

  const handleSendNotification = async (): Promise<void> => {
    if (!token || !notificationTitle.trim() || !notificationContent.trim()) {
      setErrorMessage("请先填写通知标题和内容");
      return;
    }
    if (!broadcast && !targetUserId.trim()) {
      setErrorMessage("单人通知需要填写目标用户编号");
      return;
    }

    setIsSendingNotification(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await sendAdminNotification(token, {
        broadcast,
        target_id: broadcast ? undefined : targetUserId.trim(),
        kind: notificationKind.trim() ? Number(notificationKind.trim()) : undefined,
        title: notificationTitle.trim(),
        content: notificationContent.trim(),
      });
      setNotificationTitle("");
      setNotificationContent("");
      setNotificationKind("");
      if (!broadcast) {
        setTargetUserId("");
      }
      setSuccessMessage(`通知发送成功，影响用户数 ${result.affected}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "发送通知失败");
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleCreateChat = async (): Promise<void> => {
    if (!token || !newChatUserId.trim() || !newChatContent.trim()) {
      setErrorMessage("请先填写目标用户编号和消息内容");
      return;
    }

    setIsCreatingChat(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await sendAdminChatMessage(token, {
        recipient_id: newChatUserId.trim(),
        content: newChatContent.trim(),
      });
      setNewChatUserId("");
      setNewChatContent("");
      await loadConversations(token, { nextSelectedConversationId: result.conversation_id });
      const detail = await getAdminConversationMessages(token, {
        conversation_id: result.conversation_id,
        offset: 0,
        limit: MESSAGE_LIMIT,
      });
      setConversationDetail(detail);
      setSuccessMessage("管理员会话已发送");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "发起管理员会话失败");
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!token || !selectedConversation || !draft.trim()) {
      return;
    }

    setIsSendingChat(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await sendAdminChatMessage(token, {
        recipient_id: selectedConversation.peer_id,
        conversation_id: selectedConversation.conversation_id,
        content: draft.trim(),
      });
      setDraft("");
      await loadConversations(token, { nextSelectedConversationId: result.conversation_id });
      const detail = await getAdminConversationMessages(token, {
        conversation_id: result.conversation_id,
        offset: 0,
        limit: MESSAGE_LIMIT,
      });
      setConversationDetail(detail);
      setSuccessMessage("消息已发送");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "发送消息失败");
    } finally {
      setIsSendingChat(false);
    }
  };

  const renderMessageBubble = (message: ChatMessageItem) => {
    const isMine = message.sender_role === 2;
    return (
      <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
            isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border"
          }`}
        >
          <p className="break-words whitespace-pre-wrap">{message.content}</p>
          <p
            className={`mt-2 text-xs ${isMine ? "text-primary-foreground/80" : "text-muted-foreground"}`}
          >
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
          <h1 className="text-3xl font-bold tracking-tight">管理员消息中心</h1>
          <p className="text-muted-foreground text-sm">
            向全服或单个用户下发通知，并管理管理员与用户的私信会话。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">返回管理首页</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
            >
              {isRefreshing ? "刷新中..." : "刷新会话"}
            </Button>
          </div>
        </header>

        {isBootstrapping ? (
          <p className="text-muted-foreground">加载管理员消息中心中...</p>
        ) : (
          <>
            {(errorMessage || successMessage) && (
              <Card>
                <CardContent className="space-y-2 pt-6">
                  {errorMessage && <p className="text-destructive text-sm">{errorMessage}</p>}
                  {successMessage && <p className="text-primary text-sm">{successMessage}</p>}
                </CardContent>
              </Card>
            )}

            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>发送系统通知</CardTitle>
                    <CardDescription>支持全服公告和单人通知。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={broadcast}
                        onChange={(event) => setBroadcast(event.target.checked)}
                      />
                      发送全服公告
                    </label>

                    {!broadcast && (
                      <div className="grid gap-2">
                        <Label htmlFor="admin-message-target-id">目标用户编号</Label>
                        <Input
                          id="admin-message-target-id"
                          value={targetUserId}
                          onChange={(event) => setTargetUserId(event.target.value)}
                          placeholder="输入接收通知的用户编号"
                        />
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="admin-message-kind">通知类型编号（可选）</Label>
                      <Input
                        id="admin-message-kind"
                        value={notificationKind}
                        onChange={(event) => setNotificationKind(event.target.value)}
                        placeholder="留空时自动按广播/单人通知处理"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="admin-message-title">通知标题</Label>
                      <Input
                        id="admin-message-title"
                        value={notificationTitle}
                        onChange={(event) => setNotificationTitle(event.target.value)}
                        placeholder="例如：系统维护通知"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="admin-message-content">通知内容</Label>
                      <textarea
                        id="admin-message-content"
                        value={notificationContent}
                        onChange={(event) => setNotificationContent(event.target.value)}
                        rows={6}
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[144px] rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        placeholder="写下想通知给用户的内容"
                      />
                    </div>

                    <Button
                      onClick={() => void handleSendNotification()}
                      disabled={isSendingNotification}
                    >
                      {isSendingNotification
                        ? "发送中..."
                        : broadcast
                          ? "发送全服公告"
                          : "发送单人通知"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>发起管理员会话</CardTitle>
                    <CardDescription>管理员可以无条件向用户发起聊天。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="admin-chat-user-id">用户编号</Label>
                      <Input
                        id="admin-chat-user-id"
                        value={newChatUserId}
                        onChange={(event) => setNewChatUserId(event.target.value)}
                        placeholder="输入要联系的用户编号"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="admin-chat-content">首条消息</Label>
                      <textarea
                        id="admin-chat-content"
                        value={newChatContent}
                        onChange={(event) => setNewChatContent(event.target.value)}
                        rows={5}
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[128px] rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        placeholder="输入管理员要发送的消息"
                      />
                    </div>
                    <Button onClick={() => void handleCreateChat()} disabled={isCreatingChat}>
                      {isCreatingChat ? "发送中..." : "发起管理员会话"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>会话列表</CardTitle>
                    <CardDescription>查看管理员与用户之间的当前聊天窗口。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {conversations.length === 0 ? (
                      <p className="text-muted-foreground text-sm">暂无管理员会话</p>
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
                        ? `与 ${selectedConversation.peer_name || `用户 ${selectedConversation.peer_id}`} 的聊天`
                        : "聊天窗口"}
                    </CardTitle>
                    <CardDescription>
                      {selectedConversation
                        ? `${conversationStatusLabel(conversationDetail?.status ?? selectedConversation.status)} · ${
                            (conversationDetail?.can_send ?? selectedConversation.can_send)
                              ? "当前可继续发送"
                              : "当前不可发送"
                          }`
                        : "从左侧选择一条会话查看详情。"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedConversation || !conversationDetail ? (
                      <p className="text-muted-foreground text-sm">
                        请选择一个会话查看完整聊天记录。
                      </p>
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
                          <Label htmlFor="admin-chat-draft">发送回复</Label>
                          <textarea
                            id="admin-chat-draft"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            rows={5}
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[136px] rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            placeholder="输入回复内容"
                            disabled={!conversationDetail.can_send || isSendingChat}
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={() => void handleSendMessage()}
                            disabled={
                              !conversationDetail.can_send || isSendingChat || !draft.trim()
                            }
                          >
                            {isSendingChat ? "发送中..." : "发送消息"}
                          </Button>
                          {!conversationDetail.can_send && (
                            <p className="text-muted-foreground self-center text-sm">
                              当前会话状态不允许发送消息。
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
