import { MESSAGE_API_PATHS } from "@/constants/api-paths";
import { request, withBearerAuthorization } from "@/services/request";

export interface PagePayload {
  offset?: number;
  limit?: number;
  unread_only?: boolean;
}

export interface NotificationItem {
  id: string;
  recipient_id: string;
  sender_id: string;
  sender_role: number;
  kind: number;
  title: string;
  content: string;
  is_read: boolean;
  created_at: number;
  extra?: Record<string, string>;
}

export interface NotificationListResult {
  items: NotificationItem[];
  total: number;
  unread_count: number;
}

export interface UnreadSummaryResult {
  notification_unread: number;
  conversation_unread: number;
  total_unread: number;
}

export interface ConversationItem {
  conversation_id: string;
  peer_id: string;
  peer_role: number;
  peer_name: string;
  peer_email: string;
  status: number;
  unread_count: number;
  latest_message: string;
  latest_message_at: number;
  updated_at: number;
  can_send: boolean;
}

export interface ConversationListResult {
  items: ConversationItem[];
  total: number;
  unread_count: number;
}

export interface ChatMessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: number;
  recipient_id: string;
  recipient_role: number;
  content: string;
  is_read: boolean;
  created_at: number;
}

export interface ConversationMessagesPayload {
  conversation_id: string;
  offset?: number;
  limit?: number;
}

export interface ConversationMessagesResult {
  items: ChatMessageItem[];
  status: number;
  can_send: boolean;
  pending_sender_id: string;
  pending_sender_role: number;
}

export interface UserSendChatPayload {
  recipient_id?: string;
  conversation_id?: string;
  content: string;
}

export interface AdminSendChatPayload {
  recipient_id: string;
  conversation_id?: string;
  content: string;
}

export interface SendChatResult {
  conversation_id: string;
  message: ChatMessageItem;
  status: number;
  can_send: boolean;
}

export interface MarkNotificationPayload {
  notification_id: string;
}

export interface MarkConversationPayload {
  conversation_id: string;
}

export interface AdminSendNotificationPayload {
  broadcast?: boolean;
  target_id?: string;
  kind?: number;
  title: string;
  content: string;
  extra?: Record<string, string>;
}

export interface AdminSendNotificationResult {
  affected: number;
}

export interface EmptyResult {
  success?: boolean;
}

const getWithToken = <T>(token: string, path: string): Promise<T> =>
  request<T>(path, {
    method: "GET",
    headers: withBearerAuthorization(token),
  });

const postWithToken = <T>(token: string, path: string, payload: unknown): Promise<T> =>
  request<T>(path, {
    method: "POST",
    headers: withBearerAuthorization(token),
    body: JSON.stringify(payload),
  });

export const getUnreadSummary = (token: string): Promise<UnreadSummaryResult> =>
  getWithToken<UnreadSummaryResult>(token, MESSAGE_API_PATHS.getUnreadSummary);

export const listNotifications = (
  token: string,
  payload: PagePayload = {},
): Promise<NotificationListResult> =>
  postWithToken<NotificationListResult>(token, MESSAGE_API_PATHS.listNotifications, payload);

export const markNotificationRead = (
  token: string,
  payload: MarkNotificationPayload,
): Promise<EmptyResult> =>
  postWithToken<EmptyResult>(token, MESSAGE_API_PATHS.markNotificationRead, payload);

export const markAllNotificationsRead = (token: string): Promise<EmptyResult> =>
  postWithToken<EmptyResult>(token, MESSAGE_API_PATHS.markAllNotificationsRead, {});

export const listConversations = (
  token: string,
  payload: PagePayload = {},
): Promise<ConversationListResult> =>
  postWithToken<ConversationListResult>(token, MESSAGE_API_PATHS.listConversations, payload);

export const getConversationMessages = (
  token: string,
  payload: ConversationMessagesPayload,
): Promise<ConversationMessagesResult> =>
  postWithToken<ConversationMessagesResult>(
    token,
    MESSAGE_API_PATHS.getConversationMessages,
    payload,
  );

export const sendUserChatMessage = (
  token: string,
  payload: UserSendChatPayload,
): Promise<SendChatResult> =>
  postWithToken<SendChatResult>(token, MESSAGE_API_PATHS.sendUserChatMessage, payload);

export const markConversationRead = (
  token: string,
  payload: MarkConversationPayload,
): Promise<EmptyResult> =>
  postWithToken<EmptyResult>(token, MESSAGE_API_PATHS.markConversationRead, payload);

export const sendAdminNotification = (
  token: string,
  payload: AdminSendNotificationPayload,
): Promise<AdminSendNotificationResult> =>
  postWithToken<AdminSendNotificationResult>(token, MESSAGE_API_PATHS.sendAdminNotification, payload);

export const listAdminConversations = (
  token: string,
  payload: PagePayload = {},
): Promise<ConversationListResult> =>
  postWithToken<ConversationListResult>(token, MESSAGE_API_PATHS.listAdminConversations, payload);

export const getAdminConversationMessages = (
  token: string,
  payload: ConversationMessagesPayload,
): Promise<ConversationMessagesResult> =>
  postWithToken<ConversationMessagesResult>(
    token,
    MESSAGE_API_PATHS.getAdminConversationMessages,
    payload,
  );

export const sendAdminChatMessage = (
  token: string,
  payload: AdminSendChatPayload,
): Promise<SendChatResult> =>
  postWithToken<SendChatResult>(token, MESSAGE_API_PATHS.sendAdminChatMessage, payload);

export const markAdminConversationRead = (
  token: string,
  payload: MarkConversationPayload,
): Promise<EmptyResult> =>
  postWithToken<EmptyResult>(token, MESSAGE_API_PATHS.markAdminConversationRead, payload);
