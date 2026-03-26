// ─── 用户中心服务（通过 BFF: /api/usercenter/v1/*）─────────────────────────
const USER_CENTER_BFF_V1_PREFIX = "/api/usercenter/v1";

export const USER_CENTER_API_PATHS = {
  register: `${USER_CENTER_BFF_V1_PREFIX}/user/register`,
  login: `${USER_CENTER_BFF_V1_PREFIX}/user/login`,
  getUser: `${USER_CENTER_BFF_V1_PREFIX}/user/get`,
  updateUser: `${USER_CENTER_BFF_V1_PREFIX}/user/update`,
  logout: `${USER_CENTER_BFF_V1_PREFIX}/user/logout`,
  deleteUser: `${USER_CENTER_BFF_V1_PREFIX}/user/delete`,
} as const;

// ─── 管理服务（通过 BFF: /api/admincenter/v1/*）────────────────────────────
const ADMIN_CENTER_BFF_V1_PREFIX = "/api/admincenter/v1";

export const ADMIN_CENTER_API_PATHS = {
  create: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/create`,
  login: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/login`,
  getUser: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/getuser`,
  getSelf: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/getself`,
  getUserList: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/getuserlist`,
  deleteUser: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/delete`,
  updateSelf: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/update`,
  updateUser: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/updateuser`,
  resetUserPassword: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/resetuserpassword`,
  banUser: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/banuser`,
  unbanUser: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/unbanuser`,
  logout: `${ADMIN_CENTER_BFF_V1_PREFIX}/admin/logout`,
} as const;

// ─── 文章服务（通过 BFF: /api/article/*）───────────────────────────────────
const ARTICLE_BFF_PREFIX = "/api/article";

export const ARTICLE_API_PATHS = {
  upload: `${ARTICLE_BFF_PREFIX}/v1/upload`,
  create: `${ARTICLE_BFF_PREFIX}/v1/article`,
  getById: (id: string) => `${ARTICLE_BFF_PREFIX}/v1/article/${encodeURIComponent(id)}`,
  updateById: (id: string) => `${ARTICLE_BFF_PREFIX}/v1/article/${encodeURIComponent(id)}`,
  deleteById: (id: string) => `${ARTICLE_BFF_PREFIX}/v1/article/${encodeURIComponent(id)}`,
  list: `${ARTICLE_BFF_PREFIX}/v1/articles`,
} as const;

// ─── 封面服务（通过 BFF: /api/cover/*）────────────────────────────────────
const COVER_BFF_PREFIX = "/api/cover";

export const COVER_API_PATHS = {
  upload: `${COVER_BFF_PREFIX}/upload`,
} as const;

// ─── 评论服务（通过 BFF: /api/comment/*）───────────────────────────────────
const COMMENT_BFF_PREFIX = "/api/comment";

export const COMMENT_API_PATHS = {
  create: `${COMMENT_BFF_PREFIX}/v1/comment/create`,
  list: `${COMMENT_BFF_PREFIX}/v1/comment/list`,
} as const;

// ─── 点赞服务（通过 BFF: /api/like/*）──────────────────────────────────────
const LIKE_BFF_PREFIX = "/api/like";

export const LIKE_API_PATHS = {
  likeAction: `${LIKE_BFF_PREFIX}/v1/likeaction`,
  getTargetLikerList: `${LIKE_BFF_PREFIX}/v1/gettargetlikerlist`,
  getUserTotalLike: `${LIKE_BFF_PREFIX}/v1/getusertotallike`,
  getUserLikeList: `${LIKE_BFF_PREFIX}/v1/getuserlikelist`,
  getLikeCount: `${LIKE_BFF_PREFIX}/v1/getlikecount`,
  getLikeState: `${LIKE_BFF_PREFIX}/v1/getlikestate`,
} as const;

// ─── 关注服务（通过 BFF: /api/follow/*）────────────────────────────────────
const FOLLOW_BFF_PREFIX = "/api/follow";

export const FOLLOW_API_PATHS = {
  follow: `${FOLLOW_BFF_PREFIX}/v1/follow`,
  unfollow: `${FOLLOW_BFF_PREFIX}/v1/unfollow`,
  block: `${FOLLOW_BFF_PREFIX}/v1/block`,
  unblock: `${FOLLOW_BFF_PREFIX}/v1/unblock`,
  getFollowList: `${FOLLOW_BFF_PREFIX}/v1/follow/list`,
  getBlockList: `${FOLLOW_BFF_PREFIX}/v1/block/list`,
  getFollowerList: `${FOLLOW_BFF_PREFIX}/v1/follower/list`,
  getRecommendations: `${FOLLOW_BFF_PREFIX}/v1/recommendations`,
} as const;

const FAVORITE_BFF_PREFIX = "/api/favorite";
const FAVORITE_V1_PREFIX = `${FAVORITE_BFF_PREFIX}/v1`;

export const FAVORITE_API_PATHS = {
  createFolder: `${FAVORITE_V1_PREFIX}/folder/create`,
  deleteFolder: `${FAVORITE_V1_PREFIX}/folder/delete`,
  listFolders: `${FAVORITE_V1_PREFIX}/folder/list`,
  updateFolder: `${FAVORITE_V1_PREFIX}/folder/update`,
  createItem: `${FAVORITE_V1_PREFIX}/item/create`,
  deleteItem: `${FAVORITE_V1_PREFIX}/item/delete`,
  listItems: `${FAVORITE_V1_PREFIX}/item/list`,
} as const;

const MESSAGE_BFF_PREFIX = "/api/message";

export const MESSAGE_API_PATHS = {
  getUnreadSummary: `${MESSAGE_BFF_PREFIX}/v1/unread`,
  listNotifications: `${MESSAGE_BFF_PREFIX}/v1/notifications/list`,
  markNotificationRead: `${MESSAGE_BFF_PREFIX}/v1/notifications/read`,
  markAllNotificationsRead: `${MESSAGE_BFF_PREFIX}/v1/notifications/readall`,
  listConversations: `${MESSAGE_BFF_PREFIX}/v1/conversations/list`,
  getConversationMessages: `${MESSAGE_BFF_PREFIX}/v1/conversations/messages`,
  sendUserChatMessage: `${MESSAGE_BFF_PREFIX}/v1/conversations/send`,
  markConversationRead: `${MESSAGE_BFF_PREFIX}/v1/conversations/read`,
  sendAdminNotification: `${MESSAGE_BFF_PREFIX}/v1/admin/notifications/send`,
  listAdminConversations: `${MESSAGE_BFF_PREFIX}/v1/admin/conversations/list`,
  getAdminConversationMessages: `${MESSAGE_BFF_PREFIX}/v1/admin/conversations/messages`,
  sendAdminChatMessage: `${MESSAGE_BFF_PREFIX}/v1/admin/conversations/send`,
  markAdminConversationRead: `${MESSAGE_BFF_PREFIX}/v1/admin/conversations/read`,
} as const;

const HOT_BFF_PREFIX = "/api/hot";

export const HOT_API_PATHS = {
  list: (page = 1, pageSize = 20) =>
    `${HOT_BFF_PREFIX}/v1/articles?page=${encodeURIComponent(String(page))}&page_size=${encodeURIComponent(String(pageSize))}`,
} as const;

// ─── 任务服务（通过 BFF: /api/taskcenter/v1/*）────────────────────────────
const TASK_CENTER_BFF_V1_PREFIX = "/api/taskcenter/v1";

export const TASK_CENTER_API_PATHS = {
  getTaskProgress: `${TASK_CENTER_BFF_V1_PREFIX}/task/get`,
} as const;

// ─── 推荐服务（通过 BFF: /api/reco/*）─────────────────────────────────────
const RECO_BFF_PREFIX = "/api/reco";
const RECO_V1_PREFIX = `${RECO_BFF_PREFIX}/v1`;

export const RECO_API_PATHS = {
  recommend: `${RECO_V1_PREFIX}/reco/recommend`,
  search: `${RECO_V1_PREFIX}/search`,
  ingest: `${RECO_V1_PREFIX}/docs/ingest`,
  tools: `${RECO_V1_PREFIX}/tools`,
  health: `${RECO_BFF_PREFIX}/health`,
} as const;
