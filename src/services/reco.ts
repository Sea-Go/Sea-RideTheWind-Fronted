import { RECO_API_PATHS } from "@/constants/api-paths";
import { request } from "@/services/request";

export interface RecommendArticlesPayload {
  rec_request_id: string;
  user_id: string;
  session_id: string;
  surface: string;
  query: string;
  period_bucket: string;
  /** 频道名（IP 主题频道，空表示默认流） */
  channel?: string;
  /** 标签过滤（召回阶段硬过滤，配合频道独立池） */
  tag_filter?: TagFilter;
  /** 推荐自定义配置（业务二开 + 模型二开 + A/B 分桶） */
  config?: RecommendConfig;
  /** 路径模式（fast/slow/hybrid），与 config.path_mode 二选一，request 优先 */
  path_mode?: PathMode;
}

export interface RecommendArticleItem {
  article_id?: string | number;
  id?: string | number;
  target_id?: string | number;
  [key: string]: unknown;
}

export interface RecommendArticlesResponse {
  trace_id?: string;
  rec_request_id?: string;
  status?: string;
  ids?: string[];
  explanation?: string;
  data?: RecommendArticlesResponse;
  list?: RecommendArticleItem[];
  articles?: RecommendArticleItem[];
  items?: RecommendArticleItem[];
  /** 实际走过的路径（fast/slow/hybrid） */
  path_taken?: PathMode;
  /** 成本报告（含 token 与缓存命中） */
  cost?: CostReport;
  /** 实际生效配置（含默认值回填） */
  config?: RecommendConfig;
  /** 图谱查询 trace（Cypher + 结果数 + 耗时，JSON） */
  graph_trace?: GraphTrace;
  /** article_id → 质量分 */
  quality_scores?: QualityScores;
  /** article_id → CF 分 */
  cf_scores?: CFScores;
  /** article_id → rerank 分 */
  rerank_scores?: RerankScores;
  /** 时间画像快照（JSON，调试用） */
  temporal_profile?: TemporalProfileSnapshot;
  [key: string]: unknown;
}

export interface ContentSearchPayload {
  search_request_id: string;
  user_id: string;
  session_id: string;
  query: string;
  topk: number;
  need_answer?: boolean;
  explain: boolean;
}

export interface StructuredSearchPayload {
  search_request_id: string;
  query: string;
  topk: number;
}

export interface OnboardingQuestionnairePayload {
  user_id: string;
  username?: string;
  interests: string[];
  primary_purpose: string;
  preferred_article_types: string[];
  preferred_article_length: string;
  preferred_style: string;
  backgrounds: string[];
  difficulty_preference: string;
  excluded_contents?: string[];
  reading_time_slots?: string[];
  personalized_recommendation_types: string[];
}

export interface OnboardingQuestionnaireResponse {
  trace_id?: string;
  status?: string;
  user_id?: string;
  period_bucket?: string;
  memory_types?: string[];
  updated_at?: string;
  warnings?: string[];
}

export interface SearchRecoHit {
  article_id?: string | number;
  id?: string | number;
  target_id?: string | number;
  author_id?: string | number;
  author_name?: string;
  title?: string;
  brief?: string;
  cover?: string;
  manual_type_tag?: string;
  secondary_tags?: string[];
  snippet?: string;
  chunk_id?: string;
  type_tags?: string;
  tags?: string;
  article_score?: number;
  vector_score?: number;
  rerank_score?: number;
  match_score?: number;
  [key: string]: unknown;
}

export interface SearchRecoAuthorHit {
  author_id?: string | number;
  author_name?: string;
  article_count?: number;
  latest_article_id?: string | number;
  latest_article_title?: string;
  latest_article_time?: string;
  [key: string]: unknown;
}

export interface SearchExplainTraceItem {
  name?: string;
  data?: Record<string, unknown>;
}

export interface SearchRecoData {
  trace_id?: string;
  request_id?: string;
  search_request_id?: string;
  status?: string;
  answer?: string;
  intent?: Record<string, unknown>;
  hits?: SearchRecoHit[];
  items?: SearchRecoHit[];
  explanation?: string;
  explain_trace?: SearchExplainTraceItem[];
  debug?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SearchRecoArticleData {
  trace_id?: string;
  request_id?: string;
  search_request_id?: string;
  status?: string;
  items?: SearchRecoHit[];
  [key: string]: unknown;
}

export interface SearchRecoAuthorData {
  trace_id?: string;
  request_id?: string;
  search_request_id?: string;
  status?: string;
  authors?: SearchRecoAuthorHit[];
  [key: string]: unknown;
}

export interface SearchResponse {
  code?: number;
  msg?: string;
  data?: SearchRecoData;
  [key: string]: unknown;
}

export interface SearchArticleResponse {
  code?: number;
  msg?: string;
  data?: SearchRecoArticleData;
  [key: string]: unknown;
}

export interface SearchAuthorResponse {
  code?: number;
  msg?: string;
  data?: SearchRecoAuthorData;
  [key: string]: unknown;
}

export interface IngestDocumentPayload {
  article_id: string;
  score: number;
  markdown: string;
}

export interface IngestDocumentResponse {
  article_id: string;
  coarse_vector_inserted: boolean;
  fine_vector_inserted: number;
  fine_chunk_count: number;
  graph_enabled: boolean;
  graph_write_ok: boolean;
}

export interface RecoToolsResponse {
  tools: string[];
}

export interface RecoHealthResponse {
  status: string;
}

export type RecoEventType =
  | "impression"
  | "click"
  | "like"
  | "dislike"
  | "favorite"
  | "read_complete";

export interface RecoEventItem {
  rec_request_id: string;
  user_id?: string;
  session_id?: string;
  surface: string;
  article_id: string;
  rank?: number;
  event_type: RecoEventType;
  metadata?: Record<string, unknown>;
}

export interface RecoEventPayload {
  events: RecoEventItem[];
}

export interface RecoEventResponse {
  accepted: number;
}

export interface RecoMetricValue {
  key: string;
  label: string;
  category: string;
  value: number;
  unit: string;
  description: string;
  source: string;
}

export interface RecoEvaluationSummary {
  surface: string;
  window: string;
  window_seconds: number;
  generated_at: string;
  request_count: number;
  impression_count: number;
  click_count: number;
  conversion_count: number;
  metric_values: RecoMetricValue[];
}

// ─── 双路径（dual-path）类型 ───────────────────────────────────────────────

/** 推荐路径模式（OrchestratorAgent 路由决策依据） */
export type PathMode = "fast" | "slow" | "hybrid";

/** 标签过滤（召回阶段硬过滤，配合频道独立池） */
export interface TagFilter {
  /** 命中任一即保留（OR） */
  include_tags?: string[];
  /** 命中任一即排除（NOT） */
  exclude_tags?: string[];
  /** 一级标签精确匹配 */
  manual_type_tag?: string;
  /** 二级标签 */
  secondary_tags?: string[];
  [key: string]: unknown;
}

/** 推荐自定义配置（业务二开 + 模型二开 + A/B 分桶） */
export interface RecommendConfig {
  /** 返回条数，默认 10 */
  top_k?: number;
  /** 召回策略组合：content,cf,graph,channel,rule */
  recall_strategy?: string;
  /** rerank 模型版本：self / external / llm */
  rerank_model?: string;
  /** rerank 各源权重 */
  rerank_weights?: Record<string, number>;
  /** 是否启用 Agent 循环（slow 路径） */
  agent_loop_enabled?: boolean;
  /** 召回不足时是否兜底 */
  fallback_enabled?: boolean;
  /** Agent 最大工具调用次数（WithMaxIterations） */
  max_tool_calls?: number;
  /** Prompt Cache 开关 */
  prompt_cache_enabled?: boolean;
  /** Session Summary 开关 */
  summary_enabled?: boolean;
  /** QualityAgent Best-of-N 次数 */
  best_of_n?: number;
  /** 质量阈值过滤 */
  quality_threshold?: number;
  /** 是否启用 CF 召回 */
  cf_enabled?: boolean;
  /** 是否启用搜索召回 */
  search_enabled?: boolean;
  /** 时间画像衰减开关 */
  temporal_decay_enabled?: boolean;
  /** 路径模式 */
  path_mode?: PathMode;
  /** 质量评判模型版本 */
  quality_model?: string;
  /** Prompt Cache 分桶键（频道+用户） */
  prompt_cache_key?: string;
  [key: string]: unknown;
}

/** 成本报告（响应回填，含 token 与缓存命中） */
export interface CostReport {
  /** 输入 token */
  input_tokens?: number;
  /** 输出 token */
  output_tokens?: number;
  /** 缓存命中 token */
  cached_tokens?: number;
  /** 估算成本（元） */
  cost_yuan?: number;
  /** 端到端延迟（毫秒） */
  latency_ms?: number;
  /** 分阶段 token（intent/recall/graph/rerank/quality/explain） */
  per_stage_tokens?: Record<string, number>;
  /** 分阶段延迟 */
  per_stage_latency_ms?: Record<string, number>;
  [key: string]: unknown;
}

/** 图谱查询 trace（Cypher + 结果数 + 耗时，JSON 解析后结构） */
export interface GraphTrace {
  /** 执行的 Cypher 语句 */
  cypher?: string;
  /** 结果节点数 */
  node_count?: number;
  /** 结果边数 */
  edge_count?: number;
  /** 查询耗时（毫秒） */
  latency_ms?: number;
  /** 命中实体列表 */
  entities?: string[];
  /** 关联文章ID列表 */
  related_articles?: string[];
  /** 子图 JSON（节点+边，前端可视化） */
  subgraph?: string;
  [key: string]: unknown;
}

/** 质量分映射（article_id → 质量分） */
export type QualityScores = Record<string, number>;

/** CF 分映射（article_id → CF 分） */
export type CFScores = Record<string, number>;

/** Rerank 分映射（article_id → rerank 分） */
export type RerankScores = Record<string, number>;

/** 时间画像快照（JSON 解析后结构，调试用） */
export interface TemporalProfileSnapshot {
  /** 计算时间（毫秒） */
  computed_at?: number;
  /** 长期兴趣标签快照 */
  long_term_tags?: string[];
  /** 短期兴趣标签快照 */
  short_term_tags?: string[];
  /** 周期模式槽位 */
  periodic_slots?: Record<string, string[]>;
  /** 趋势兴趣标签 */
  trending_tags?: string[];
  /** 衰减状态摘要 */
  decay_state?: Record<string, number>;
  /** 淘汰池标签 */
  archived_tags?: string[];
  [key: string]: unknown;
}

// ─── 搜索（search）类型 ────────────────────────────────────────────────────

/** 搜索意图类型 */
export type SearchIntentType =
  | "informational"
  | "navigational"
  | "transactional"
  | "comparative";

/** 搜索意图（SearchAgent.understand 输出） */
export interface SearchIntent {
  /** 意图类型 */
  label?: SearchIntentType;
  /** 置信度 */
  confidence?: number;
  /** 触发信号 */
  signals?: string[];
  /** 复杂度（0~1） */
  complexity?: number;
  /** 实体（作者/IP/标签/标题） */
  entities?: string[];
  /** 时效意图（latest/within_7d/within_30d/ever） */
  time_intent?: string;
  [key: string]: unknown;
}

/** 重写后的查询（SearchAgent.rewrite 输出） */
export interface RewrittenQuery {
  /** 原始 query */
  original?: string;
  /** 重写后 query */
  rewritten?: string;
  /** 同义词扩展 */
  synonyms?: string[];
  /** 相关词 */
  related?: string[];
  /** 拼写纠正（空表示无需纠正） */
  correction?: string;
  [key: string]: unknown;
}

/** 搜索过滤 */
export interface SearchFilter {
  /** 标签过滤 */
  tags?: string[];
  /** 一级标签 */
  manual_type_tag?: string;
  /** IP 频道 */
  channel?: string;
  /** 作者 */
  author_id?: string;
  /** 时间范围起（毫秒） */
  time_from?: number;
  /** 时间范围止（毫秒） */
  time_to?: number;
  /** 质量阈值 */
  quality_threshold?: number;
  [key: string]: unknown;
}

/** 搜索补全 */
export interface SearchSuggestion {
  /** 补全文本 */
  text?: string;
  /** 补全分 */
  score?: number;
  /** 来源（prefix/hot/personalize） */
  source?: string;
  [key: string]: unknown;
}

/** 图谱知识（实体识别后查图谱获取） */
export interface GraphKnowledge {
  /** 命中实体 */
  entities?: string[];
  /** 关联文章ID */
  related_articles?: string[];
  /** 关联作者ID */
  related_authors?: string[];
  /** 关联 IP */
  related_ips?: string[];
  /** 生成的 Cypher（调试用） */
  cypher?: string;
  /** 子图 JSON（节点+边，前端可视化） */
  subgraph?: string;
  [key: string]: unknown;
}

// ─── 频道（channel）类型 ───────────────────────────────────────────────────

/** IP 绑定规则（type_tag + secondary_tags 组合绑定 IP 主题） */
export interface IPBindingRule {
  /** 一级标签 */
  type_tag?: string;
  /** 二级标签组合 */
  secondary_tags?: string[];
  /** IP 名称（如"旅游"） */
  ip_name?: string;
  /** 是否独占（命中后不再进默认流） */
  exclusive?: boolean;
  [key: string]: unknown;
}

/** 频道配置（独立池 + 质量阈值 + filterKey + rerank 版本 + IP 绑定） */
export interface ChannelConfig {
  /** 独立召回池最小水位（不足触发兜底） */
  pool_min_size?: number;
  /** 独立召回池最大水位 */
  pool_max_size?: number;
  /** 频道独立质量阈值 */
  quality_threshold?: number;
  /** 画像 filterKey（频道切换隔离） */
  filter_key?: string;
  /** 频道独立 rerank 模型版本 */
  rerank_model_version?: string;
  /** rerank 模型类型：self / external / llm */
  rerank_model_type?: string;
  /** IP 绑定规则 */
  ip_binding?: IPBindingRule;
  [key: string]: unknown;
}

/** 频道（IP 主题频道） */
export interface Channel {
  /** 频道名（唯一键，如 travel / game） */
  name?: string;
  /** 展示名 */
  display_name?: string;
  /** 描述 */
  description?: string;
  /** 绑定 IP */
  ip_name?: string;
  /** 频道配置 */
  config?: ChannelConfig;
  /** 当前池水位 */
  pool_current_size?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 创建时间（毫秒） */
  create_time?: number;
  /** 更新时间（毫秒） */
  update_time?: number;
  [key: string]: unknown;
}

/** 频道列表响应 */
export interface ListChannelsResponse {
  channels?: Channel[];
  total?: number;
  [key: string]: unknown;
}

/** 注册频道请求（二开点：业务方注册自定义 IP 频道） */
export interface RegisterChannelPayload {
  /** 频道名 */
  name: string;
  /** 展示名 */
  display_name?: string;
  /** 描述 */
  description?: string;
  /** 绑定 IP */
  ip_name?: string;
  /** 频道配置 */
  config?: ChannelConfig;
  /** IP 绑定规则 */
  ip_binding?: IPBindingRule;
  /** 是否启用 */
  enabled?: boolean;
  [key: string]: unknown;
}

// ─── 质量（quality）类型 ───────────────────────────────────────────────────

/** 文章质量 6 维评分（LLM Verifier + Best-of-N） */
export interface ArticleQuality {
  /** 文章ID */
  article_id?: string;
  /** 权威性（0~1） */
  authority?: number;
  /** 深度（0~1） */
  depth?: number;
  /** 时效性（0~1） */
  freshness?: number;
  /** 完整性（0~1） */
  completeness?: number;
  /** 可读性（0~1） */
  readability?: number;
  /** 引用质量（0~1） */
  citation?: number;
  /** 综合分（加权） */
  overall?: number;
  /** 等级（A~T，logprobs 概率分布取 max） */
  grade?: string;
  /** 等级概率分布 */
  grade_distribution?: Record<string, number>;
  /** 评判模型版本 */
  judge_model?: string;
  /** 评判时间（毫秒） */
  judged_at?: number;
  [key: string]: unknown;
}

/** 质量反馈（反馈闭环） */
export interface QualityFeedback {
  /** 文章ID */
  article_id?: string;
  /** 反馈类型：upvote / downvote / flag */
  feedback_type?: string;
  /** 反馈原因 */
  reason?: string;
  /** 标注人ID（管理员） */
  annotator_id?: string;
  /** 反馈时间（毫秒） */
  create_time?: number;
  [key: string]: unknown;
}

// ─── 重排（rerank）类型 ────────────────────────────────────────────────────

/** rerank 模型类型：self / external / llm */
export type RerankModelType = "self" | "external" | "llm";

/** rerank 模型版本（self/external 切换 + A/B 分桶） */
export interface RerankModel {
  /** 版本号 */
  version?: string;
  /** 模型类型 */
  type?: RerankModelType;
  /** 模型产物路径（ONNX/GGUF） */
  artifact_path?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 流量占比（A/B 分桶） */
  traffic_ratio?: number;
  /** 创建时间（毫秒） */
  create_time?: number;
  /** 离线指标（NDCG@10/CTR 等） */
  metrics?: Record<string, string>;
  [key: string]: unknown;
}

/** A/B 测试配置 */
export interface ABTestConfig {
  /** 实验名 */
  name?: string;
  /** 对照组版本 */
  control_version?: string;
  /** 实验组版本 */
  treatment_version?: string;
  /** 对照组流量 */
  control_ratio?: number;
  /** 实验组流量 */
  treatment_ratio?: number;
  /** 对比指标（CTR/CVR/latency/cost） */
  metrics?: string[];
  /** 是否启用 */
  enabled?: boolean;
  /** 开始时间（毫秒） */
  start_time?: number;
  /** 结束时间（毫秒） */
  end_time?: number;
  [key: string]: unknown;
}

/** 模型版本切换 */
export interface ModelVersion {
  /** 当前生效版本 */
  current_version?: string;
  /** 当前类型 */
  current_type?: RerankModelType;
  /** 降级版本（self 失败回退 external） */
  fallback_version?: string;
  /** 降级类型 */
  fallback_type?: RerankModelType;
  /** 进行中的 A/B */
  ab_test?: ABTestConfig;
  [key: string]: unknown;
}

// ─── 协同过滤（cf）类型 ────────────────────────────────────────────────────

/** CF 算法类型 */
export type CFAlgoType = "user_cf" | "item_cf" | "mf";

/** CF 分数 */
export interface CFScore {
  /** 文章ID */
  article_id?: string;
  /** User-CF 分 */
  user_cf_score?: number;
  /** Item-CF 分 */
  item_cf_score?: number;
  /** MF 分 */
  mf_score?: number;
  /** 融合分 */
  fused_score?: number;
  /** 来源（user_cf/item_cf/mf/coldstart） */
  source?: string;
  [key: string]: unknown;
}

/** CF 配置 */
export interface CFConfig {
  /** 主算法 */
  algo?: CFAlgoType;
  /** 各算法权重（融合） */
  weights?: Record<string, number>;
  /** Top-N 相似数 */
  top_n_similar?: number;
  /** MF 隐因子维度（64/128） */
  mf_factors?: number;
  /** 增量刷新间隔（秒，5min 增量 / 1h 全量） */
  refresh_interval_sec?: number;
  /** 是否实时增量更新 */
  online_update?: boolean;
  [key: string]: unknown;
}

/** 冷启动配置 */
export interface ColdStartConfig {
  /** 新用户用画像召回 */
  use_profile_recall?: boolean;
  /** 热门兜底 */
  use_hot_fallback?: boolean;
  /** 新文章用内容向量迁移 CF 分 */
  use_content_cf_transfer?: boolean;
  /** 热门兜底条数 */
  hot_top_k?: number;
  [key: string]: unknown;
}

// ─── 用户画像（profile）类型 ───────────────────────────────────────────────

/** 静态画像（注册/onboarding） */
export interface StaticProfile {
  username?: string;
  interests?: string[];
  primary_purpose?: string;
  preferred_article_types?: string[];
  preferred_article_length?: string;
  preferred_style?: string;
  backgrounds?: string[];
  difficulty_preference?: string;
  excluded_contents?: string[];
  reading_time_slots?: string[];
  personalized_recommendation_types?: string[];
  /** onboarding 时间（毫秒） */
  onboarded_at?: number;
  [key: string]: unknown;
}

/** 动态画像（偏好演化） */
export interface DynamicProfile {
  current_tags?: string[];
  current_topics?: string[];
  tier?: string;
  long_term_tags?: string[];
  short_term_tags?: string[];
  [key: string]: unknown;
}

/** 行为画像（事件统计） */
export interface BehaviorProfile {
  total_clicks?: number;
  total_likes?: number;
  total_dislikes?: number;
  total_favorites?: number;
  total_read_complete?: number;
  total_searches?: number;
  /** 标签 → 点击数 */
  tag_clicks?: Record<string, number>;
  /** 作者 → 关注数 */
  author_follows?: Record<string, number>;
  /** 最近活跃时间（毫秒） */
  last_active_time?: number;
  [key: string]: unknown;
}

/** 兴趣条目（每兴趣含 Tag/Weight/Strength/LastReinforcedAt/DecayTau/Archived） */
export interface InterestEntry {
  /** 标签 */
  tag?: string;
  /** 权重 */
  weight?: number;
  /** 强度 S */
  strength?: number;
  /** 最近强化时间（毫秒） */
  last_reinforced_at?: number;
  /** 衰减时间常数（秒） */
  decay_tau?: number;
  /** 是否归档（淘汰池） */
  archived?: boolean;
  [key: string]: unknown;
}

/** 长期兴趣 */
export interface LongTermInterests {
  entries?: InterestEntry[];
  /** 计算时间（毫秒） */
  computed_at?: number;
  [key: string]: unknown;
}

/** 短期兴趣 */
export interface ShortTermInterests {
  entries?: InterestEntry[];
  /** 窗口起（毫秒） */
  window_start?: number;
  /** 窗口止（毫秒） */
  window_end?: number;
  [key: string]: unknown;
}

/** 周期模式（按时间槽位） */
export interface PeriodicPattern {
  /** slot（如 "0-6"/"6-12"）→ 兴趣 */
  slot_tags?: Record<string, InterestEntry[]>;
  /** 粒度（hour/day/weekday） */
  granularity?: string;
  /** 计算时间（毫秒） */
  computed_at?: number;
  [key: string]: unknown;
}

/** 趋势兴趣（24h vs 7d 基线，2σ 突增） */
export interface TrendingInterests {
  entries?: TrendingEntry[];
  /** 检测时间（毫秒） */
  detected_at?: number;
  [key: string]: unknown;
}

/** 趋势条目 */
export interface TrendingEntry {
  tag?: string;
  /** 当前速率 */
  current_rate?: number;
  /** 基线速率 */
  baseline_rate?: number;
  /** 突增 z-score */
  z_score?: number;
  is_trending?: boolean;
  [key: string]: unknown;
}

/** 衰减状态 */
export interface DecayState {
  /** 全局衰减常数 */
  global_decay_tau?: number;
  /** Ebbinghaus 强度 */
  ebbinghaus_s?: number;
  /** 最近衰减 tick（毫秒） */
  last_tick_at?: number;
  /** 标签级衰减常数 */
  per_tag_tau?: Record<string, number>;
  [key: string]: unknown;
}

/** 淘汰池 */
export interface EliminationPool {
  /** 已淘汰标签 */
  archived_tags?: string[];
  /** 复活候选 */
  revive_candidates?: ReviveCandidate[];
  /** 最近 tick（毫秒） */
  last_tick_at?: number;
  [key: string]: unknown;
}

/** 复活候选 */
export interface ReviveCandidate {
  tag?: string;
  archived_score?: number;
  /** 淘汰时间（毫秒） */
  archived_at?: number;
  [key: string]: unknown;
}

/** 时间画像（长期/短期/会话/周期/趋势 + 衰减 + 淘汰） */
export interface TemporalProfile {
  /** 长期兴趣 */
  long_term?: LongTermInterests;
  /** 短期兴趣 */
  short_term?: ShortTermInterests;
  /** 会话兴趣 */
  session?: InterestEntry[];
  /** 周期模式 */
  periodic?: PeriodicPattern;
  /** 趋势兴趣 */
  trending?: TrendingInterests;
  /** 衰减状态 */
  decay_state?: DecayState;
  /** 淘汰池 */
  elimination_pool?: EliminationPool;
  [key: string]: unknown;
}

/** 用户画像三层（静态/动态/行为）+ 时间画像层 */
export interface UserProfile {
  /** 用户ID */
  user_id?: string;
  /** 静态层（注册信息） */
  static?: StaticProfile;
  /** 动态层（偏好） */
  dynamic?: DynamicProfile;
  /** 行为层（事件统计） */
  behavior?: BehaviorProfile;
  /** 时间画像层 */
  temporal?: TemporalProfile;
  /** 更新时间（毫秒） */
  update_time?: number;
  [key: string]: unknown;
}

// ─── 评估（eval）类型 ──────────────────────────────────────────────────────

/** 评估指标类型 */
export type EvalMetricType =
  | "recall_at_k"
  | "ndcg_at_k"
  | "ctr"
  | "cvr"
  | "llm_judge"
  | "rubric";

/** Rubric 维度 */
export interface RubricCriterion {
  /** 维度名（accuracy/authority/depth/...） */
  name?: string;
  /** 权重 */
  weight?: number;
  /** 评分描述 */
  description?: string;
  /** 评分尺度（A~T 或 0~1） */
  scale?: string;
  [key: string]: unknown;
}

/** Rubric（LLM Judge 评分标准） */
export interface Rubric {
  name?: string;
  /** 评分维度 */
  criteria?: RubricCriterion[];
  /** 评判模型 */
  judge_model?: string;
  /** 版本 */
  version?: number;
  [key: string]: unknown;
}

/** 评估用例（golden case） */
export interface EvalCase {
  case_id?: string;
  name?: string;
  /** 所属频道 */
  channel?: string;
  /** 所属 IP */
  ip?: string;
  /** 所属意图 */
  intent?: string;
  /** 输入 query */
  query?: string;
  /** 期望文章ID（确定性指标） */
  expected_article_ids?: string[];
  /** 期望标签 */
  expected_tags?: string[];
  /** 期望元数据 */
  expected_metadata?: Record<string, string>;
  /** LLM Judge rubric */
  rubric?: Rubric;
  /** 标注人 */
  annotator_id?: string;
  /** 创建时间（毫秒） */
  create_time?: number;
  /** 更新时间（毫秒） */
  update_time?: number;
  enabled?: boolean;
  [key: string]: unknown;
}

/** 评估指标 */
export interface EvalMetric {
  /** 指标类型 */
  type?: EvalMetricType;
  /** K 值（Recall@K/NDCG@K） */
  k?: number;
  /** 指标值 */
  value?: number;
  /** 单位 */
  unit?: string;
  /** 样本数 */
  sample_count?: number;
  [key: string]: unknown;
}

/** 行为漂移报告 */
export interface BehaviorDriftReport {
  report_id?: string;
  /** 窗口起（毫秒） */
  window_start?: number;
  /** 窗口止（毫秒） */
  window_end?: number;
  /** 当前指标分布 */
  current_distribution?: Record<string, number>;
  /** 历史基线分布 */
  baseline_distribution?: Record<string, number>;
  /** 各指标漂移分 */
  drift_scores?: Record<string, number>;
  /** 漂移指标列表 */
  drifted_metrics?: string[];
  /** 漂移阈值 */
  threshold?: number;
  /** 是否漂移 */
  drifted?: boolean;
  /** 生成时间（毫秒） */
  generated_at?: number;
  [key: string]: unknown;
}

/** 人工标注 */
export interface Annotation {
  annotation_id?: string;
  /** 关联用例 */
  case_id?: string;
  /** 标注人 */
  annotator_id?: string;
  /** 关联推荐结果 */
  recommendation_id?: string;
  /** 标注的文章ID */
  article_ids?: string[];
  /** 标签（relevant/irrelevant/partial） */
  label?: string;
  /** 标注分 */
  score?: number;
  /** 备注 */
  comment?: string;
  /** 标注时间（毫秒） */
  create_time?: number;
  [key: string]: unknown;
}

// ─── CPU（cpu）类型 ────────────────────────────────────────────────────────

/** 池统计 */
export interface PoolStat {
  /** 池名（recall/rerank/cf/graph/...） */
  name?: string;
  /** 当前大小 */
  size?: number;
  /** 活跃数 */
  active?: number;
  /** 等待数 */
  waiting?: number;
  /** 容量 */
  capacity?: number;
  /** 利用率 */
  utilization?: number;
  /** 累计处理数 */
  total_processed?: number;
  [key: string]: unknown;
}

/** GOMAXPROCS 配置 */
export interface GOMAXPROCSConfig {
  /** 当前 GOMAXPROCS */
  current?: number;
  /** CPU 配额（automaxprocs 读取） */
  quota?: number;
  /** 是否启用 automaxprocs */
  automaxprocs_enabled?: boolean;
  /** 推荐值 */
  recommended?: number;
  [key: string]: unknown;
}

/** 缓存统计 */
export interface CacheStat {
  /** 缓存名（L1_article_meta/L2_recall/L3_prompt） */
  name?: string;
  /** L1/L2/L3 */
  level?: string;
  /** 当前条目数 */
  size?: number;
  /** 容量 */
  capacity?: number;
  /** 命中数 */
  hits?: number;
  /** 未命中数 */
  misses?: number;
  /** 命中率 */
  hit_ratio?: number;
  /** 淘汰数 */
  evictions?: number;
  /** 平均延迟（微秒） */
  latency_us?: number;
  [key: string]: unknown;
}

/** CPU profile 快照 */
export interface CPUProfile {
  /** 采样时间（毫秒） */
  captured_at?: number;
  /** goroutine 数 */
  goroutines?: number;
  /** ants 池大小 */
  pool_size?: number;
  /** ants 池活跃数 */
  pool_active?: number;
  /** pprof 采样数 */
  pprof_samples?: number;
  /** CPU 利用率 */
  cpu_usage?: number;
  /** GC 暂停（纳秒） */
  gc_pause_ns?: number;
  /** GC 次数 */
  gc_count?: number;
  /** 各池统计 */
  pools?: PoolStat[];
  /** 各缓存统计 */
  caches?: CacheStat[];
  /** GOMAXPROCS 配置 */
  gomaxprocs?: GOMAXPROCSConfig;
  /** 火焰图 SVG/JSON */
  flame_graph?: string;
  [key: string]: unknown;
}

// ─── 图谱（graph）类型 ─────────────────────────────────────────────────────

/** 图谱节点类型（12 类，与 schema.go 一致） */
export type GraphNodeType =
  | "article"
  | "tag"
  | "type_tag"
  | "author"
  | "ip"
  | "channel"
  | "topic"
  | "entity"
  | "image"
  | "user"
  | "behavior"
  | "quality_report";

/** 图谱节点 */
export interface GraphNode {
  /** 节点ID */
  id?: string;
  /** 节点类型 */
  type?: GraphNodeType;
  /** 节点名 */
  name?: string;
  /** 节点属性 */
  properties?: Record<string, string>;
  /** 标签 */
  labels?: string[];
  [key: string]: unknown;
}

/** 图谱边 */
export interface GraphEdge {
  /** 起点ID */
  source_id?: string;
  /** 终点ID */
  target_id?: string;
  /** 关系类型（HAS_TAG/WROTE_BY/LIKED/CO_OCCURRED_WITH/VISUALLY_SIMILAR/...） */
  relation?: string;
  /** 起点类型 */
  source_type?: GraphNodeType;
  /** 终点类型 */
  target_type?: GraphNodeType;
  /** 边属性（如 count/weight） */
  properties?: Record<string, string>;
  [key: string]: unknown;
}

/** Cypher 执行请求 */
export interface CypherRequest {
  /** Cypher 语句（参数化） */
  cypher: string;
  /** 参数 */
  params?: Record<string, string>;
  /** 结果上限 */
  limit?: number;
  /** 只读（默认 true） */
  read_only?: boolean;
  [key: string]: unknown;
}

/** 节点类型 Schema */
export interface NodeTypeSchema {
  type?: GraphNodeType;
  name?: string;
  properties?: string[];
  indexes?: string[];
  description?: string;
  [key: string]: unknown;
}

/** 关系 Schema */
export interface RelationSchema {
  relation?: string;
  source_type?: GraphNodeType;
  target_type?: GraphNodeType;
  properties?: string[];
  description?: string;
  [key: string]: unknown;
}

/** 索引 Schema */
export interface IndexSchema {
  node_type?: GraphNodeType;
  fields?: string[];
  unique?: boolean;
  [key: string]: unknown;
}

/** 约束 Schema */
export interface ConstraintSchema {
  node_type?: GraphNodeType;
  field?: string;
  /** uniqueness/existence */
  constraint_type?: string;
  [key: string]: unknown;
}

/** 图谱 Schema 响应（12 类节点 + 关系定义） */
export interface GraphSchema {
  /** 12 类节点 */
  node_types?: NodeTypeSchema[];
  /** 关系定义 */
  relations?: RelationSchema[];
  /** 索引 */
  indexes?: IndexSchema[];
  /** 约束 */
  constraints?: ConstraintSchema[];
  /** 版本 */
  version?: number;
  [key: string]: unknown;
}

// ─── Skill（skill）类型 ────────────────────────────────────────────────────

/** Skill 类别（12 类） */
export type SkillCategory =
  | "recall"
  | "rank"
  | "quality"
  | "search"
  | "graph"
  | "profile"
  | "channel"
  | "event"
  | "explain"
  | "eval"
  | "tool"
  | "obs";

/** Skill 清单（SKILL.md 内容） */
export interface SkillManifest {
  name?: string;
  description?: string;
  /** 触发条件 */
  trigger_condition?: string;
  /** 使用说明 */
  usage?: string;
  version?: string;
  author?: string;
  [key: string]: unknown;
}

/** Skill 清单 */
export interface Skill {
  /** 唯一名（如 recall.content） */
  name?: string;
  /** 类别 */
  category?: SkillCategory;
  /** 展示名 */
  display_name?: string;
  /** 描述 */
  description?: string;
  /** SKILL.md 清单 */
  manifest?: SkillManifest;
  /** 绑定工具 */
  tools?: string[];
  /** 绑定资源 */
  resources?: string[];
  /** 是否启用 */
  enabled?: boolean;
  /** 是否内置（false 表示业务二开） */
  builtin?: boolean;
  /** 创建时间（毫秒） */
  create_time?: number;
  [key: string]: unknown;
}

/** 调用 Skill 请求 */
export interface InvokeSkillPayload {
  /** Skill 名 */
  name: string;
  /** 输入（JSON） */
  input?: string;
  /** 链路追踪ID */
  trace_id?: string;
  /** 是否物化到 tool result（不污染 Prompt Cache 前缀） */
  materialize_to_tool_result?: boolean;
  /** 超时（秒） */
  timeout_sec?: number;
  [key: string]: unknown;
}

export const recommendArticles = (
  payload: RecommendArticlesPayload,
): Promise<RecommendArticlesResponse> =>
  request<RecommendArticlesResponse>(RECO_API_PATHS.recommend, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const searchRecoByContent = (payload: ContentSearchPayload): Promise<SearchResponse> =>
  request<SearchResponse>(RECO_API_PATHS.search, {
    method: "POST",
    body: JSON.stringify(payload),
    responseMode: "raw",
  });

export const searchRecoByTitle = (
  payload: StructuredSearchPayload,
): Promise<SearchArticleResponse> =>
  request<SearchArticleResponse>(RECO_API_PATHS.searchTitle, {
    method: "POST",
    body: JSON.stringify(payload),
    responseMode: "raw",
  });

export const searchRecoByAuthor = (
  payload: StructuredSearchPayload,
): Promise<SearchAuthorResponse> =>
  request<SearchAuthorResponse>(RECO_API_PATHS.searchAuthors, {
    method: "POST",
    body: JSON.stringify(payload),
    responseMode: "raw",
  });

export const submitOnboardingQuestionnaire = (
  payload: OnboardingQuestionnairePayload,
): Promise<OnboardingQuestionnaireResponse> =>
  request<OnboardingQuestionnaireResponse>(RECO_API_PATHS.onboardingQuestionnaire, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const ingestDocument = (payload: IngestDocumentPayload): Promise<IngestDocumentResponse> =>
  request<IngestDocumentResponse>(RECO_API_PATHS.ingest, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listRecoTools = (): Promise<RecoToolsResponse> =>
  request<RecoToolsResponse>(RECO_API_PATHS.tools, {
    method: "GET",
  });

export const getRecoHealth = (): Promise<RecoHealthResponse> =>
  request<RecoHealthResponse>(RECO_API_PATHS.health, {
    method: "GET",
  });

export const recordRecoEvents = (payload: RecoEventPayload): Promise<RecoEventResponse> =>
  request<RecoEventResponse>(RECO_API_PATHS.events, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getRecoEvaluationSummary = ({
  surface = "dashboard_recommend",
  window = "24h",
}: {
  surface?: string;
  window?: string;
} = {}): Promise<RecoEvaluationSummary> =>
  request<RecoEvaluationSummary>(
    `${RECO_API_PATHS.evaluationSummary}?surface=${encodeURIComponent(surface)}&window=${encodeURIComponent(window)}`,
    {
      method: "GET",
    },
  );

/** 获取频道列表（用户前台，默认仅返回启用频道） */
export const getRecoChannels = (enabledOnly = true): Promise<ListChannelsResponse> =>
  request<ListChannelsResponse>(
    `${RECO_API_PATHS.channels}?enabled_only=${encodeURIComponent(String(enabledOnly))}`,
    {
      method: "GET",
    },
  );

/** 获取当前用户画像（用户前台 self，include_temporal 控制是否返回时间画像） */
export const getMyProfile = (includeTemporal = false): Promise<UserProfile> =>
  request<UserProfile>(
    `${RECO_API_PATHS.profileMe}?include_temporal=${encodeURIComponent(String(includeTemporal))}`,
    {
      method: "GET",
    },
  );

/**
 * 流式推荐（AG-UI SSE）。
 * 直接使用 fetch 返回 Response，调用方通过 response.body 读取 ReadableStream，
 * 不走 request helper（后者会缓冲整个响应体，不适用于流式）。
 */
export const recommendArticlesStream = (
  payload: RecommendArticlesPayload,
): Promise<Response> =>
  fetch(RECO_API_PATHS.recommendStream, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
