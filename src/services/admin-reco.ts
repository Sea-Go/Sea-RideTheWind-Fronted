import { ADMIN_RECO_API_PATHS } from "@/constants/api-paths";
import { request } from "@/services/request";
import type {
  ABTestConfig,
  Annotation,
  ArticleQuality,
  BehaviorDriftReport,
  CacheStat,
  CFAlgoType,
  CFConfig,
  ChannelConfig,
  ColdStartConfig,
  CPUProfile,
  DecayState,
  EvalCase,
  EvalMetric,
  EvalMetricType,
  GOMAXPROCSConfig,
  GraphEdge,
  GraphNode,
  GraphNodeType,
  GraphSchema,
  InvokeSkillPayload,
  ListChannelsResponse,
  ModelVersion,
  PoolStat,
  QualityFeedback,
  RegisterChannelPayload,
  RerankModel,
  RerankModelType,
  Skill,
  SkillCategory,
  SkillManifest,
  TemporalProfile,
  UserProfile,
} from "@/services/reco";

// ═══════════════════════════════════════════════════════════════════════════
// 频道（channel）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** 注册/更新/删除频道响应 */
export interface RegisterChannelResponse {
  /** 注册成功的频道名 */
  name?: string;
  success?: boolean;
  [key: string]: unknown;
}

/** 更新频道请求（管理员，name 路径参数，其余为可选更新字段） */
export interface UpdateChannelPayload {
  display_name?: string;
  description?: string;
  config?: ChannelConfig;
  enabled?: boolean;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// 质量（quality）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** Rubric 维度明细（quality.proto 的 RubricDimension） */
export interface RubricDimension {
  /** 维度名 */
  name?: string;
  /** 得分（0~1） */
  score?: number;
  /** 评判理由 */
  rationale?: string;
  /** 证据片段 */
  evidence?: string;
  [key: string]: unknown;
}

/** 质量报告（含 Rubrics 维度 + 评语） */
export interface ArticleQualityReport {
  article_id?: string;
  /** 6 维评分 */
  quality?: ArticleQuality;
  /** Rubric 各维度明细 */
  rubrics?: RubricDimension[];
  /** 质量总结 */
  summary?: string;
  /** validate grounding 结果（PASS/FAIL + 原因） */
  grounding_result?: string;
  /** 报告生成时间（毫秒） */
  create_time?: number;
  [key: string]: unknown;
}

/** 质量评估请求 */
export interface QualityEvaluatePayload {
  article_id: string;
  /** 是否 Best-of-N */
  use_best_of_n?: boolean;
  /** Best-of-N 次数 */
  n?: number;
  /** 指定评判模型 */
  judge_model?: string;
  /** 是否返回概率分布 */
  logprobs?: boolean;
  [key: string]: unknown;
}

/** 质量评估响应 */
export interface QualityEvaluateResponse {
  report?: ArticleQualityReport;
  success?: boolean;
  err_msg?: string;
  [key: string]: unknown;
}

/** 批量质量评估请求 */
export interface BatchQualityEvaluatePayload {
  article_ids: string[];
  use_best_of_n?: boolean;
  n?: number;
  judge_model?: string;
  logprobs?: boolean;
  [key: string]: unknown;
}

/** 批量质量评估响应 */
export interface BatchQualityEvaluateResponse {
  reports?: ArticleQualityReport[];
  success?: boolean;
  err_msg?: string;
  [key: string]: unknown;
}

/** 质量反馈响应 */
export interface QualityFeedbackResp {
  success?: boolean;
  err_msg?: string;
  [key: string]: unknown;
}

/** 质量反馈列表请求 */
export interface ListQualityFeedbackPayload {
  article_id?: string;
  feedback_type?: string;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

/** 质量反馈列表响应 */
export interface ListQualityFeedbackResponse {
  feedbacks?: QualityFeedback[];
  total?: number;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// 重排（rerank）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** rerank 模型列表请求 */
export interface ListRerankModelsPayload {
  type?: RerankModelType;
  enabled_only?: boolean;
  [key: string]: unknown;
}

/** rerank 模型列表响应 */
export interface ListRerankModelsResponse {
  models?: RerankModel[];
  total?: number;
  [key: string]: unknown;
}

/** 模型版本更新请求 */
export interface UpdateModelVersionPayload {
  current_version?: string;
  current_type?: RerankModelType;
  fallback_version?: string;
  fallback_type?: RerankModelType;
  [key: string]: unknown;
}

/** rerank 推理请求（内部 RPC 调试） */
export interface RerankInferPayload {
  trace_id?: string;
  user_id?: string;
  query?: string;
  /** 候选文章ID */
  article_ids: string[];
  /** 指定版本（空则用当前生效） */
  model_version?: string;
  /** 指定类型 */
  model_type?: RerankModelType;
  top_k?: number;
  [key: string]: unknown;
}

/** rerank 推理响应 */
export interface RerankInferResponse {
  trace_id?: string;
  /** 排序后文章ID */
  ranked_article_ids?: string[];
  /** article_id → rerank 分 */
  scores?: Record<string, number>;
  /** 实际使用版本 */
  model_version?: string;
  /** 实际使用类型 */
  model_type?: RerankModelType;
  /** 是否触发降级 */
  fallback_triggered?: boolean;
  err_msg?: string;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// 协同过滤（cf）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** CF 配置响应（config + cold_start） */
export interface CFConfigResponse {
  config?: CFConfig;
  cold_start?: ColdStartConfig;
  success?: boolean;
  [key: string]: unknown;
}

/** 更新 CF 配置请求 */
export interface UpdateCFConfigPayload {
  config?: CFConfig;
  cold_start?: ColdStartConfig;
  [key: string]: unknown;
}

/** 相似用户 */
export interface SimilarUser {
  user_id?: string;
  similarity?: number;
  shared_articles?: string[];
  [key: string]: unknown;
}

/** 相似用户请求 */
export interface CFSimilarUsersPayload {
  user_id: string;
  top_n?: number;
  algo?: CFAlgoType;
  [key: string]: unknown;
}

/** 相似用户响应 */
export interface CFSimilarUsersResponse {
  users?: SimilarUser[];
  [key: string]: unknown;
}

/** 相似文章 */
export interface SimilarItem {
  article_id?: string;
  similarity?: number;
  /** 共现次数 */
  co_occur_count?: number;
  [key: string]: unknown;
}

/** 相似文章请求 */
export interface CFSimilarItemsPayload {
  article_id: string;
  top_n?: number;
  algo?: CFAlgoType;
  [key: string]: unknown;
}

/** 相似文章响应 */
export interface CFSimilarItemsResponse {
  items?: SimilarItem[];
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// 画像（profile）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** 画像调优请求（管理员调参） */
export interface ProfileTuningPayload {
  user_id: string;
  /** 调整衰减参数 */
  decay_state?: DecayState;
  /** 强制复活标签 */
  force_revive_tags?: string[];
  /** 强制淘汰标签 */
  force_archive_tags?: string[];
  /** 覆盖时间画像（调试） */
  override?: TemporalProfile;
  [key: string]: unknown;
}

/** 画像调优响应 */
export interface ProfileTuningResponse {
  /** 调优后画像 */
  profile?: UserProfile;
  success?: boolean;
  err_msg?: string;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// 评估（eval）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** 评估用例列表请求 */
export interface ListEvalCasesPayload {
  channel?: string;
  ip?: string;
  intent?: string;
  enabled_only?: boolean;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

/** 评估用例列表响应 */
export interface ListEvalCasesResponse {
  cases?: EvalCase[];
  total?: number;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

/** 评估运行请求 */
export interface EvalRunPayload {
  /** 指定用例（空则全量） */
  case_ids?: string[];
  channel?: string;
  ip?: string;
  intent?: string;
  metrics?: EvalMetricType[];
  k?: number;
  /** 对比基线版本 */
  baseline_version?: string;
  /** 是否检测漂移 */
  detect_drift?: boolean;
  judge_model?: string;
  [key: string]: unknown;
}

/** 用例级评估结果 */
export interface EvalCaseResult {
  case_id?: string;
  /** 实际推荐 */
  actual_article_ids?: string[];
  /** 用例级指标 */
  metrics?: EvalMetric[];
  /** 是否通过 */
  passed?: boolean;
  /** LLM Judge 理由 */
  rationale?: string;
  [key: string]: unknown;
}

/** 评估运行响应 */
export interface EvalRunResponse {
  run_id?: string;
  metrics?: EvalMetric[];
  case_results?: EvalCaseResult[];
  /** 漂移报告（detect_drift=true） */
  drift_report?: BehaviorDriftReport;
  run_at?: number;
  err_msg?: string;
  [key: string]: unknown;
}

/** 漂移报告请求 */
export interface GetEvalReportPayload {
  window_start?: number;
  window_end?: number;
  [key: string]: unknown;
}

/** 提交标注响应 */
export interface SubmitAnnotationResponse {
  annotation_id?: string;
  success?: boolean;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// CPU（cpu）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** CPU profile 请求 */
export interface GetCPUProfilePayload {
  include_flame_graph?: boolean;
  [key: string]: unknown;
}

/** pprof 请求 */
export interface PProfPayload {
  /** profile 类型（cpu/heap/goroutine/block/mutex） */
  profile_type: string;
  /** 采样时长（秒） */
  duration_sec?: number;
  /** 是否返回火焰图 */
  flame_graph?: boolean;
  /** 采样频率 */
  sample_rate?: number;
  [key: string]: unknown;
}

/** pprof 响应 */
export interface PProfResponse {
  /** pprof 原始数据（base64） */
  profile_data?: string;
  /** 火焰图（SVG/JSON） */
  flame_graph?: string;
  captured_at?: number;
  err_msg?: string;
  [key: string]: unknown;
}

/** 池列表响应 */
export interface ListPoolsResponse {
  pools?: PoolStat[];
  [key: string]: unknown;
}

/** 缓存列表响应 */
export interface ListCachesResponse {
  caches?: CacheStat[];
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// 图谱（graph）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** 图谱查询请求（LLM 生成 Cypher） */
export interface GraphQueryPayload {
  trace_id?: string;
  user_id?: string;
  /** 自然语言查询 */
  query: string;
  /** 是否 LLM 生成 Cypher */
  generate_cypher?: boolean;
  /** 多跳上限 */
  hop_limit?: number;
  top_k?: number;
  [key: string]: unknown;
}

/** 图谱查询响应 */
export interface GraphQueryResponse {
  /** 生成的 Cypher */
  cypher?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  /** 子图 JSON（前端可视化） */
  subgraph?: string;
  latency_ms?: number;
  err_msg?: string;
  [key: string]: unknown;
}

/** Cypher 执行响应 */
export interface CypherResponse {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  /** 原始行结果 */
  rows?: Record<string, string>[];
  latency_ms?: number;
  err_msg?: string;
  [key: string]: unknown;
}

/** 图谱召回请求（多跳召回候选文章） */
export interface GraphRecallPayload {
  user_id?: string;
  channel?: string;
  /** 种子文章 */
  seed_article_ids?: string[];
  /** 种子实体 */
  seed_entities?: string[];
  /** 召回模板（user_liked_similar/user_similar_user/co_occur/entity/article_author/ip/...） */
  template?: string;
  top_k?: number;
  hop_limit?: number;
  [key: string]: unknown;
}

/** 图谱召回候选 */
export interface GraphRecallCandidate {
  article_id?: string;
  score?: number;
  /** 召回路径（JSON） */
  path?: string;
  [key: string]: unknown;
}

/** 图谱召回响应 */
export interface GraphRecallResponse {
  candidates?: GraphRecallCandidate[];
  /** 执行的 Cypher */
  cypher?: string;
  latency_ms?: number;
  [key: string]: unknown;
}

/** 实体链接请求 */
export interface EntityLinkPayload {
  /** 输入文本 */
  query: string;
  /** 候选实体类型 */
  candidate_types?: GraphNodeType[];
  top_k?: number;
  /** 相似度阈值 */
  threshold?: number;
  [key: string]: unknown;
}

/** 链接实体 */
export interface LinkedEntity {
  entity_id?: string;
  type?: GraphNodeType;
  name?: string;
  similarity?: number;
  aliases?: string[];
  [key: string]: unknown;
}

/** 实体链接响应 */
export interface EntityLinkResponse {
  entities?: LinkedEntity[];
  [key: string]: unknown;
}

/** 图片搜索请求（以图搜文 / 以图搜图） */
export interface ImageSearchPayload {
  /** 图片URL */
  image_url?: string;
  /** 图片字节（base64，二选一） */
  image_bytes?: string;
  /** image_to_article / image_to_image */
  search_type?: string;
  top_k?: number;
  threshold?: number;
  [key: string]: unknown;
}

/** 图片搜索命中 */
export interface ImageSearchHit {
  /** 关联文章ID（以图搜文） */
  article_id?: string;
  /** 图片节点ID */
  image_id?: string;
  image_url?: string;
  similarity?: number;
  [key: string]: unknown;
}

/** 图片搜索响应 */
export interface ImageSearchResponse {
  hits?: ImageSearchHit[];
  latency_ms?: number;
  err_msg?: string;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// Skill（skill）admin 类型
// ═══════════════════════════════════════════════════════════════════════════

/** 注册 Skill 请求（二开点：业务方放置技能目录） */
export interface RegisterSkillPayload {
  name: string;
  category?: SkillCategory;
  display_name?: string;
  description?: string;
  manifest?: SkillManifest;
  tools?: string[];
  resources?: string[];
  enabled?: boolean;
  /** 技能目录路径（扫描加载） */
  skill_dir?: string;
  [key: string]: unknown;
}

/** 注册 Skill 响应 */
export interface RegisterSkillResponse {
  name?: string;
  success?: boolean;
  err_msg?: string;
  [key: string]: unknown;
}

/** Skill 列表请求 */
export interface ListSkillsPayload {
  category?: SkillCategory;
  enabled_only?: boolean;
  /** 仅内置 */
  builtin_only?: boolean;
  /** 仅二开 */
  custom_only?: boolean;
  [key: string]: unknown;
}

/** Skill 列表响应 */
export interface ListSkillsResponse {
  skills?: Skill[];
  total?: number;
  /** 各类 Skill 计数 */
  category_counts?: Record<string, number>;
  [key: string]: unknown;
}

/** 启用/禁用 Skill 请求 */
export interface EnableSkillPayload {
  name: string;
  enabled: boolean;
  [key: string]: unknown;
}

/** 调用 Skill 响应 */
export interface InvokeSkillResponse {
  /** 输出（JSON） */
  output?: string;
  success?: boolean;
  latency_ms?: number;
  err_msg?: string;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// 频道（channel）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 列出全部频道（管理员视角，含未启用） */
export const listChannelsAdmin = (enabledOnly = false): Promise<ListChannelsResponse> =>
  request<ListChannelsResponse>(
    `${ADMIN_RECO_API_PATHS.listChannelsAdmin}?enabled_only=${encodeURIComponent(String(enabledOnly))}`,
    { method: "GET" },
  );

/** 注册（创建）频道 */
export const createChannel = (
  payload: RegisterChannelPayload,
): Promise<RegisterChannelResponse> =>
  request<RegisterChannelResponse>(ADMIN_RECO_API_PATHS.createChannel, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 更新频道配置 */
export const updateChannel = (
  name: string,
  payload: UpdateChannelPayload,
): Promise<RegisterChannelResponse> =>
  request<RegisterChannelResponse>(ADMIN_RECO_API_PATHS.updateChannel(name), {
    method: "PUT",
    body: JSON.stringify(payload),
  });

/** 删除频道 */
export const deleteChannel = (name: string): Promise<RegisterChannelResponse> =>
  request<RegisterChannelResponse>(ADMIN_RECO_API_PATHS.deleteChannel(name), {
    method: "DELETE",
  });

// ═══════════════════════════════════════════════════════════════════════════
// 质量（quality）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 评估单篇文章质量（6 维 + Best-of-N） */
export const evaluateQuality = (
  payload: QualityEvaluatePayload,
): Promise<QualityEvaluateResponse> =>
  request<QualityEvaluateResponse>(ADMIN_RECO_API_PATHS.evaluateQuality, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 批量评估文章质量 */
export const batchEvaluateQuality = (
  payload: BatchQualityEvaluatePayload,
): Promise<BatchQualityEvaluateResponse> =>
  request<BatchQualityEvaluateResponse>(ADMIN_RECO_API_PATHS.batchEvaluateQuality, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 提交质量反馈（反馈闭环） */
export const submitQualityFeedback = (
  payload: QualityFeedback,
): Promise<QualityFeedbackResp> =>
  request<QualityFeedbackResp>(ADMIN_RECO_API_PATHS.submitQualityFeedback, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 获取文章质量报告（含 Rubrics 维度 + 评语） */
export const getQualityReport = (articleId: string): Promise<ArticleQualityReport> =>
  request<ArticleQualityReport>(ADMIN_RECO_API_PATHS.getQualityReport(articleId), {
    method: "GET",
  });

// ═══════════════════════════════════════════════════════════════════════════
// 重排（rerank）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 列出 rerank 模型版本（self/external/llm 切换 + A/B 分桶） */
export const listRerankModels = (
  payload: ListRerankModelsPayload = {},
): Promise<ListRerankModelsResponse> => {
  const params = new URLSearchParams();
  if (payload.type) params.set("type", payload.type);
  if (payload.enabled_only) params.set("enabled_only", String(payload.enabled_only));
  const query = params.toString();
  return request<ListRerankModelsResponse>(
    `${ADMIN_RECO_API_PATHS.listRerankModels}${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
};

/** 获取当前生效模型版本（含降级配置 + 进行中 A/B） */
export const getRerankModelVersion = (): Promise<ModelVersion> =>
  request<ModelVersion>(ADMIN_RECO_API_PATHS.getModelVersion, {
    method: "GET",
  });

/** 切换当前生效模型版本 */
export const updateRerankModelVersion = (
  payload: UpdateModelVersionPayload,
): Promise<ModelVersion> =>
  request<ModelVersion>(ADMIN_RECO_API_PATHS.updateModelVersion, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

/** 获取进行中的 rerank A/B 测试配置 */
export const getRerankABTest = (): Promise<ABTestConfig> =>
  request<ABTestConfig>(ADMIN_RECO_API_PATHS.getRerankABTest, {
    method: "GET",
  });

/** 更新（创建/停止）rerank A/B 测试配置 */
export const updateRerankABTest = (payload: ABTestConfig): Promise<ABTestConfig> =>
  request<ABTestConfig>(ADMIN_RECO_API_PATHS.updateRerankABTest, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** rerank 推理调试（内部 RPC 暴露，验证候选排序） */
export const rerankInfer = (payload: RerankInferPayload): Promise<RerankInferResponse> =>
  request<RerankInferResponse>(ADMIN_RECO_API_PATHS.rerankInfer, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ═══════════════════════════════════════════════════════════════════════════
// 协同过滤（cf）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 获取 CF 配置（含冷启动配置） */
export const getCFConfig = (): Promise<CFConfigResponse> =>
  request<CFConfigResponse>(ADMIN_RECO_API_PATHS.getCFConfig, {
    method: "GET",
  });

/** 更新 CF 配置（算法切换 + 权重 + 冷启动） */
export const updateCFConfig = (
  payload: UpdateCFConfigPayload,
): Promise<CFConfigResponse> =>
  request<CFConfigResponse>(ADMIN_RECO_API_PATHS.updateCFConfig, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

/** 查询相似用户（User-CF / Item-CF / MF） */
export const getSimilarUsers = (
  payload: CFSimilarUsersPayload,
): Promise<CFSimilarUsersResponse> => {
  const params = new URLSearchParams();
  params.set("user_id", payload.user_id);
  if (payload.top_n) params.set("top_n", String(payload.top_n));
  if (payload.algo) params.set("algo", payload.algo);
  return request<CFSimilarUsersResponse>(
    `${ADMIN_RECO_API_PATHS.getSimilarUsers}?${params.toString()}`,
    { method: "GET" },
  );
};

/** 查询相似文章（共现矩阵 + Jaccard/余弦） */
export const getSimilarItems = (
  payload: CFSimilarItemsPayload,
): Promise<CFSimilarItemsResponse> => {
  const params = new URLSearchParams();
  params.set("article_id", payload.article_id);
  if (payload.top_n) params.set("top_n", String(payload.top_n));
  if (payload.algo) params.set("algo", payload.algo);
  return request<CFSimilarItemsResponse>(
    `${ADMIN_RECO_API_PATHS.getSimilarItems}?${params.toString()}`,
    { method: "GET" },
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 画像（profile）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 获取指定用户画像（管理员视角，可含时间画像） */
export const getProfileAdmin = (
  userId: string,
  includeTemporal = false,
): Promise<UserProfile> =>
  request<UserProfile>(
    `${ADMIN_RECO_API_PATHS.getProfileAdmin(userId)}?include_temporal=${encodeURIComponent(String(includeTemporal))}`,
    { method: "GET" },
  );

/** 调优用户画像（调整衰减参数 / 强制复活或淘汰标签 / 覆盖时间画像） */
export const tuneProfile = (
  payload: ProfileTuningPayload,
): Promise<ProfileTuningResponse> =>
  request<ProfileTuningResponse>(ADMIN_RECO_API_PATHS.tuneProfile, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ═══════════════════════════════════════════════════════════════════════════
// 评估（eval）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 列出评估用例（golden case，支持按频道/IP/意图筛选） */
export const listEvalCases = (
  payload: ListEvalCasesPayload = {},
): Promise<ListEvalCasesResponse> => {
  const params = new URLSearchParams();
  if (payload.channel) params.set("channel", payload.channel);
  if (payload.ip) params.set("ip", payload.ip);
  if (payload.intent) params.set("intent", payload.intent);
  if (payload.enabled_only) params.set("enabled_only", String(payload.enabled_only));
  if (payload.page) params.set("page", String(payload.page));
  if (payload.page_size) params.set("page_size", String(payload.page_size));
  const query = params.toString();
  return request<ListEvalCasesResponse>(
    `${ADMIN_RECO_API_PATHS.listEvalCases}${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
};

/** 创建/更新评估用例（upsert） */
export const createEvalCase = (payload: EvalCase): Promise<EvalCase> =>
  request<EvalCase>(ADMIN_RECO_API_PATHS.createEvalCase, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 删除评估用例 */
export const deleteEvalCase = (
  caseId: string,
): Promise<SubmitAnnotationResponse> =>
  request<SubmitAnnotationResponse>(ADMIN_RECO_API_PATHS.deleteEvalCase(caseId), {
    method: "DELETE",
  });

/** 运行评估（按用例/频道/IP/意图筛选，含 Recall@K/NDCG@K/CTR/CVR/LLM Judge/Rubric） */
export const runEval = (payload: EvalRunPayload): Promise<EvalRunResponse> =>
  request<EvalRunResponse>(ADMIN_RECO_API_PATHS.runEval, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 获取评估报告（行为漂移报告：当前分布 vs 基线，2σ 突增检测） */
export const getEvalReport = (
  payload: GetEvalReportPayload = {},
): Promise<BehaviorDriftReport> => {
  const params = new URLSearchParams();
  if (payload.window_start) params.set("window_start", String(payload.window_start));
  if (payload.window_end) params.set("window_end", String(payload.window_end));
  const query = params.toString();
  return request<BehaviorDriftReport>(
    `${ADMIN_RECO_API_PATHS.getEvalReport}${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
};

/** 提交人工标注（标注闭环：relevant/irrelevant/partial） */
export const submitAnnotation = (payload: Annotation): Promise<SubmitAnnotationResponse> =>
  request<SubmitAnnotationResponse>(ADMIN_RECO_API_PATHS.submitAnnotation, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ═══════════════════════════════════════════════════════════════════════════
// CPU（cpu）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 获取 CPU profile 快照（goroutine/池/缓存/GC + 可选火焰图） */
export const getCPUProfile = (
  payload: GetCPUProfilePayload = {},
): Promise<CPUProfile> => {
  const params = new URLSearchParams();
  if (payload.include_flame_graph)
    params.set("include_flame_graph", String(payload.include_flame_graph));
  const query = params.toString();
  return request<CPUProfile>(
    `${ADMIN_RECO_API_PATHS.getCPUProfile}${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
};

/** 采集 pprof（cpu/heap/goroutine/block/mutex + 可选火焰图） */
export const getPProf = (payload: PProfPayload): Promise<PProfResponse> =>
  request<PProfResponse>(ADMIN_RECO_API_PATHS.getPProf, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 列出各协程池统计（recall/rerank/cf/graph 等） */
export const listPools = (): Promise<ListPoolsResponse> =>
  request<ListPoolsResponse>(ADMIN_RECO_API_PATHS.listPools, {
    method: "GET",
  });

/** 列出各缓存统计（L1_article_meta/L2_recall/L3_prompt） */
export const listCacheStats = (): Promise<ListCachesResponse> =>
  request<ListCachesResponse>(ADMIN_RECO_API_PATHS.listCacheStats, {
    method: "GET",
  });

/** 获取 GOMAXPROCS 配置（含 automaxprocs 推荐值） */
export const getMaxprocs = (): Promise<GOMAXPROCSConfig> =>
  request<GOMAXPROCSConfig>(ADMIN_RECO_API_PATHS.getMaxprocs, {
    method: "GET",
  });

/** 更新 GOMAXPROCS 配置 */
export const updateMaxprocs = (payload: GOMAXPROCSConfig): Promise<GOMAXPROCSConfig> =>
  request<GOMAXPROCSConfig>(ADMIN_RECO_API_PATHS.updateMaxprocs, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

// ═══════════════════════════════════════════════════════════════════════════
// 图谱（graph）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 图谱查询（自然语言 → LLM 生成 Cypher → 多跳召回） */
export const queryGraph = (payload: GraphQueryPayload): Promise<GraphQueryResponse> =>
  request<GraphQueryResponse>(ADMIN_RECO_API_PATHS.queryGraph, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 图谱召回（多跳召回候选文章，支持多种召回模板） */
export const recallByGraph = (
  payload: GraphRecallPayload,
): Promise<GraphRecallResponse> =>
  request<GraphRecallResponse>(ADMIN_RECO_API_PATHS.recallByGraph, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 实体链接（输入文本 → 候选实体 → 相似度匹配） */
export const entityLink = (payload: EntityLinkPayload): Promise<EntityLinkResponse> =>
  request<EntityLinkResponse>(ADMIN_RECO_API_PATHS.entityLink, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 图片搜索（以图搜文 / 以图搜图） */
export const imageSearch = (payload: ImageSearchPayload): Promise<ImageSearchResponse> =>
  request<ImageSearchResponse>(ADMIN_RECO_API_PATHS.imageSearch, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 获取图谱 Schema（12 类节点 + 关系 + 索引 + 约束） */
export const getGraphSchema = (): Promise<GraphSchema> =>
  request<GraphSchema>(ADMIN_RECO_API_PATHS.getGraphSchema, {
    method: "GET",
  });

// ═══════════════════════════════════════════════════════════════════════════
// Skill（skill）admin 函数
// ═══════════════════════════════════════════════════════════════════════════

/** 列出全部 Skill（12 类，支持按类别/启用/内置/二开筛选） */
export const listSkills = (
  payload: ListSkillsPayload = {},
): Promise<ListSkillsResponse> => {
  const params = new URLSearchParams();
  if (payload.category) params.set("category", payload.category);
  if (payload.enabled_only) params.set("enabled_only", String(payload.enabled_only));
  if (payload.builtin_only) params.set("builtin_only", String(payload.builtin_only));
  if (payload.custom_only) params.set("custom_only", String(payload.custom_only));
  const query = params.toString();
  return request<ListSkillsResponse>(
    `${ADMIN_RECO_API_PATHS.listSkills}${query ? `?${query}` : ""}`,
    { method: "GET" },
  );
};

/** 注册 Skill（二开点：业务方放置技能目录扫描加载） */
export const registerSkill = (
  payload: RegisterSkillPayload,
): Promise<RegisterSkillResponse> =>
  request<RegisterSkillResponse>(ADMIN_RECO_API_PATHS.registerSkill, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 注销（删除）Skill */
export const unregisterSkill = (name: string): Promise<RegisterSkillResponse> =>
  request<RegisterSkillResponse>(ADMIN_RECO_API_PATHS.unregisterSkill(name), {
    method: "DELETE",
  });

/** 调用 Skill（输入 JSON → 输出 JSON，可物化到 tool result） */
export const invokeSkill = (
  payload: InvokeSkillPayload,
): Promise<InvokeSkillResponse> =>
  request<InvokeSkillResponse>(ADMIN_RECO_API_PATHS.invokeSkill, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** 获取 Skill 详情（含 SKILL.md 清单 manifest） */
export const getSkillManifest = (name: string): Promise<Skill> =>
  request<Skill>(ADMIN_RECO_API_PATHS.getSkill(name), {
    method: "GET",
  });
