// ─── 用户中心服务（通过 BFF: /api/usercenter/v1/*）─────────────────────────
const USER_CENTER_BFF_V1_PREFIX = "/api/usercenter/v1";

export const USER_CENTER_API_PATHS = {
  register: `${USER_CENTER_BFF_V1_PREFIX}/user/register`,
  login: `${USER_CENTER_BFF_V1_PREFIX}/user/login`,
  getUser: `${USER_CENTER_BFF_V1_PREFIX}/user/get`,
  updateUser: `${USER_CENTER_BFF_V1_PREFIX}/user/update`,
  uploadAvatar: `${USER_CENTER_BFF_V1_PREFIX}/user/avatar`,
  avatarHistory: `${USER_CENTER_BFF_V1_PREFIX}/user/avatar/history`,
  selectAvatar: `${USER_CENTER_BFF_V1_PREFIX}/user/avatar/select`,
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
  preview: `${COVER_BFF_PREFIX}/preview`,
} as const;

// ─── 评论服务（通过 BFF: /api/comment/*）───────────────────────────────────
const COMMENT_BFF_PREFIX = "/api/comment";

export const COMMENT_API_PATHS = {
  create: `${COMMENT_BFF_PREFIX}/v1/comment/create`,
  list: `${COMMENT_BFF_PREFIX}/v1/comment/list`,
  like: `${COMMENT_BFF_PREFIX}/v1/comment/like`,
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
// 新版网关前缀（与 11 个 proto 契约对齐：用户前台 /api/v1/v2/reco/*，管理员 /api/v1/v2/admin/*）
const RECO_V2_PREFIX = "/api/v1/v2";
const RECO_V2_RECO_PREFIX = `${RECO_V2_PREFIX}/reco`;
const RECO_V2_ADMIN_PREFIX = `${RECO_V2_PREFIX}/admin`;

export const RECO_API_PATHS = {
  recommend: `${RECO_V1_PREFIX}/reco/recommend`,
  events: `${RECO_V1_PREFIX}/reco/events`,
  evaluationSummary: `${RECO_V1_PREFIX}/admin/reco/evaluation/summary`,
  search: `${RECO_V1_PREFIX}/search`,
  searchTitle: `${RECO_V1_PREFIX}/search/title`,
  searchAuthors: `${RECO_V1_PREFIX}/search/authors`,
  onboardingQuestionnaire: `${RECO_V1_PREFIX}/onboarding/questionnaire`,
  ingest: `${RECO_V1_PREFIX}/docs/ingest`,
  tools: `${RECO_V1_PREFIX}/tools`,
  health: `${RECO_BFF_PREFIX}/health`,
  // 新增：v1/v2 契约对齐的用户前台路径
  recommendStream: `${RECO_V2_RECO_PREFIX}/recommend/stream`,
  channels: `${RECO_V2_RECO_PREFIX}/channels`,
  profileMe: `${RECO_V2_RECO_PREFIX}/profile/me`,
} as const;

// ─── 推荐管理服务（通过 Sea-RideTheWind 网关: /api/v1/v2/admin/*）──────────
export const ADMIN_RECO_API_PATHS = {
  // 频道管理
  listChannelsAdmin: `${RECO_V2_ADMIN_PREFIX}/channels`,
  createChannel: `${RECO_V2_ADMIN_PREFIX}/channels`,
  getChannel: (name: string) =>
    `${RECO_V2_ADMIN_PREFIX}/channels/${encodeURIComponent(name)}`,
  updateChannel: (name: string) =>
    `${RECO_V2_ADMIN_PREFIX}/channels/${encodeURIComponent(name)}`,
  deleteChannel: (name: string) =>
    `${RECO_V2_ADMIN_PREFIX}/channels/${encodeURIComponent(name)}`,
  // 质量管理
  evaluateQuality: `${RECO_V2_ADMIN_PREFIX}/quality/evaluate`,
  batchEvaluateQuality: `${RECO_V2_ADMIN_PREFIX}/quality/evaluate/batch`,
  submitQualityFeedback: `${RECO_V2_ADMIN_PREFIX}/quality/feedback`,
  listQualityFeedback: `${RECO_V2_ADMIN_PREFIX}/quality/feedback`,
  getQualityReport: (articleId: string) =>
    `${RECO_V2_ADMIN_PREFIX}/quality/report/${encodeURIComponent(articleId)}`,
  // 重排管理
  listRerankModels: `${RECO_V2_ADMIN_PREFIX}/rerank/models`,
  getModelVersion: `${RECO_V2_ADMIN_PREFIX}/rerank/version`,
  updateModelVersion: `${RECO_V2_ADMIN_PREFIX}/rerank/version`,
  getRerankABTest: `${RECO_V2_ADMIN_PREFIX}/rerank/abtest`,
  updateRerankABTest: `${RECO_V2_ADMIN_PREFIX}/rerank/abtest`,
  rerankInfer: `${RECO_V2_ADMIN_PREFIX}/rerank/infer`,
  // 协同过滤管理
  getCFConfig: `${RECO_V2_ADMIN_PREFIX}/cf/config`,
  updateCFConfig: `${RECO_V2_ADMIN_PREFIX}/cf/config`,
  getSimilarUsers: `${RECO_V2_ADMIN_PREFIX}/cf/similar/users`,
  getSimilarItems: `${RECO_V2_ADMIN_PREFIX}/cf/similar/items`,
  // 画像管理
  getProfileAdmin: (userId: string) =>
    `${RECO_V2_ADMIN_PREFIX}/profile/${encodeURIComponent(userId)}`,
  tuneProfile: `${RECO_V2_ADMIN_PREFIX}/profile/tune`,
  // 评估管理
  listEvalCases: `${RECO_V2_ADMIN_PREFIX}/eval/cases`,
  createEvalCase: `${RECO_V2_ADMIN_PREFIX}/eval/cases`,
  deleteEvalCase: (caseId: string) =>
    `${RECO_V2_ADMIN_PREFIX}/eval/cases/${encodeURIComponent(caseId)}`,
  runEval: `${RECO_V2_ADMIN_PREFIX}/eval/run`,
  getEvalReport: `${RECO_V2_ADMIN_PREFIX}/eval/reports/drift`,
  submitAnnotation: `${RECO_V2_ADMIN_PREFIX}/eval/annotate`,
  // CPU 管理
  getCPUProfile: `${RECO_V2_ADMIN_PREFIX}/cpu/profile`,
  getPProf: `${RECO_V2_ADMIN_PREFIX}/cpu/pprof`,
  listPools: `${RECO_V2_ADMIN_PREFIX}/cpu/pools`,
  listCacheStats: `${RECO_V2_ADMIN_PREFIX}/cpu/cache`,
  getMaxprocs: `${RECO_V2_ADMIN_PREFIX}/cpu/maxprocs`,
  updateMaxprocs: `${RECO_V2_ADMIN_PREFIX}/cpu/maxprocs`,
  // 图谱管理
  queryGraph: `${RECO_V2_ADMIN_PREFIX}/graph/query`,
  executeCypher: `${RECO_V2_ADMIN_PREFIX}/graph/cypher`,
  recallByGraph: `${RECO_V2_ADMIN_PREFIX}/graph/recall`,
  entityLink: `${RECO_V2_ADMIN_PREFIX}/graph/entity_link`,
  imageSearch: `${RECO_V2_ADMIN_PREFIX}/graph/image_search`,
  getGraphSchema: `${RECO_V2_ADMIN_PREFIX}/graph/schema`,
  // Skill 管理
  listSkills: `${RECO_V2_ADMIN_PREFIX}/skill/list`,
  getSkill: (name: string) =>
    `${RECO_V2_ADMIN_PREFIX}/skill/${encodeURIComponent(name)}`,
  registerSkill: `${RECO_V2_ADMIN_PREFIX}/skill/register`,
  unregisterSkill: (name: string) =>
    `${RECO_V2_ADMIN_PREFIX}/skill/${encodeURIComponent(name)}`,
  invokeSkill: `${RECO_V2_ADMIN_PREFIX}/skill/invoke`,
  enableSkill: (name: string) =>
    `${RECO_V2_ADMIN_PREFIX}/skill/${encodeURIComponent(name)}/enable`,
} as const;
