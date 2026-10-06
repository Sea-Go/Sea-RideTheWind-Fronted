// 手工镜像，待 RTW generated 下发后替换。
//
// 镜像来源（双侧同步红线，任一侧改动字段或 JSON tag 必须双边同步）：
// - BTW `service/search/rpc/internal/evidence/types.go`（Locator / LaneScores /
//   EvidenceCandidate / EvidencePack 与契约常量，§1 契约快照）；
// - RTW `service/knowledge/internal/structure`（TreeJSON / NodeJSON）。
//
// 序列化形状为 snake_case JSON，因此接口字段直接使用与 Go 侧 JSON tag
// 逐一对应的 snake_case 键名（与 generated/knowledgeComponents.ts 的
// goctl 产物惯例一致）。tier 语义（fast/balanced/deep 的字符串与预算
// 说明）按《LLM-Wiki平台工程目录与工作规范》§2.4 前端规范条款 6 集中
// 定义在本文件，选择器不得自造文案。

/** locator quote 的长度上限（rune 计），对应 BTW evidence.MaxQuoteRunes。 */
export const MAX_QUOTE_RUNES = 200;

/** 段落节点层级：标题为 ATX 1..6 级，段落固定为 7。 */
export const LEVEL_PARAGRAPH = 7;

/** 标题节点的 para_index 哨兵值（标题不占全局段落序）。 */
export const HEADING_PARA_INDEX = -1;

/** 单个 EvidencePack 允许的候选文档数上限。 */
export const MAX_CANDIDATES = 50;

/** 单个候选允许的 evidence（Locator）条数上限。 */
export const MAX_EVIDENCES_PER_CANDIDATE = 8;

/**
 * DocStructureTree 是 RTW structure.Tree 的镜像：一次冻结修订的结构树。
 * 节点按文档序排列，char_start/char_end 为源文本字节偏移（区间 [start, end)）。
 */
export interface DocStructureTree {
  /** 冻结修订 ID（结构树的派生键）。 */
  revision_id: string;
  /** 结构节点列表（标题 + 段落），按文档序。 */
  nodes: StructureNode[];
}

/**
 * StructureNode 是 RTW structure.Node 的镜像：一个标题或段落节点。
 */
export interface StructureNode {
  /** 节点 ID（RTW 派生，前端视为不透明）。 */
  node_id: string;
  /** 层级：标题 1..6，段落为 LEVEL_PARAGRAPH(7)。 */
  level: number;
  /** 标题文本（已 trim）；段落节点为空字符串。 */
  title: string;
  /** 全局段落序号；标题节点为 HEADING_PARA_INDEX(-1)。 */
  para_index: number;
  /** 节点覆盖源文本的起始字节偏移（含）。 */
  char_start: number;
  /** 节点覆盖源文本的结束字节偏移（不含）。 */
  char_end: number;
}

/**
 * Locator：文档内一处可验证的证据地址（RTW structure.Locator 镜像，
 * 增补 revision_id 字段以支持跨文档的 EvidencePack）。
 */
export interface Locator {
  /** 该 Locator 所属的冻结修订 ID（取自结构树）。 */
  revision_id: string;
  /** 从文档根到此段落之前最近的标题链；段落位于任何标题之前时为空数组。 */
  section_path: string[];
  /** 全局段落序号（RTW 派生序，非文档内局部序）。 */
  para_index: number;
  /** 证据引文：命中区间文本 TrimSpace 后，超上限截前 MAX_QUOTE_RUNES 个 rune。 */
  quote: string;
}

/**
 * LaneScores：多路召回/排序的分数快照（均 float）。
 * rerank 为 0 表示该候选未经过 rerank 阶段（语义上的“无”）。
 */
export interface LaneScores {
  /** 稠密向量路分数。 */
  dense: number;
  /** 稀疏（词法）路分数。 */
  sparse: number;
  /** 多向量路分数。 */
  multi: number;
  /** 重排分数；0 表示未经过 rerank（无此路）。 */
  rerank: number;
}

/**
 * EvidenceCandidate：EvidencePack 中的一个候选文档，
 * 携带来路分数与 1..MAX_EVIDENCES_PER_CANDIDATE 条证据 Locator。
 */
export interface EvidenceCandidate {
  /** 候选文档键（检索层的稳定文档标识）。 */
  doc_key: string;
  /** 融合后的 RRF 分数（透传，不重算）。 */
  rrf_score: number;
  /** 各路分数快照。 */
  lanes: LaneScores;
  /** 证据 Locator 列表（1..8 条）。 */
  evidence: Locator[];
}

/**
 * EvidencePack：一次搜索查询的证据载荷：查询 ID + 候选列表。
 * 作为跨服务契约对象，序列化为 snake_case JSON。
 */
export interface EvidencePack {
  /** 查询 ID（非空）。 */
  query_id: string;
  /** 候选列表（至多 MAX_CANDIDATES 条，建议按 rrf_score 降序）。 */
  candidates: EvidenceCandidate[];
}

// ─── Chat tier 语义（§2.4 前端规范条款 6：字符串与预算说明只定义于此）───

/** 问答档位标识，透传给 /api/v1/chat 的 tier 字段。 */
export type ChatTier = "fast" | "balanced" | "deep";

export interface ChatTierDef {
  /** 档位标识（唯一权威字符串）。 */
  id: ChatTier;
  /** 界面短标签。 */
  label: string;
  /** 每档一行说明（预算语义，选择器直接消费）。 */
  description: string;
}

/** 三档定义的唯一来源；组件不得自造文案或新增档位。 */
export const CHAT_TIER_DEFS: readonly ChatTierDef[] = [
  { id: "fast", label: "快答", description: "直接检索，0 次模型规划" },
  { id: "balanced", label: "均衡", description: "检索规划 + 精排" },
  { id: "deep", label: "深查", description: "多轮深查，逐层追问" },
] as const;

export const isChatTier = (value: unknown): value is ChatTier =>
  value === "fast" || value === "balanced" || value === "deep";

// ─── UI 侧词汇（citation-ui 轨；EvidencePackUI/DocStructureTreeUI 为避免与契约名冲突的后缀名）───

//
// 轨道说明：F1（chat 流式）轨与本轨各自独立创建同名文件，内容对齐
// Sea-Docs《LLM-Wiki平台工程目录与工作规范》§2.4 的同名类型草案；
// 合并时二取其一，不视为冲突。后端 RTW generated/typesscript 下发后，
// 本文件由 scripts/sync-knowledge-contract.cjs 从权威生成物刷新替换。
// 端点登记见 src/constants/api-paths.ts 的 KNOWLEDGE_V2_PATHS（后端未就绪）。

/** 引用定位：quote 高亮以 anchor.go 校验通过的字位区间为准。 */
export interface StructureLocator {
  doc_key: string;
  revision_id: string;
  /** 章节面包屑，自文档根到引用所在章节。 */
  section_path: string[];
  /** 段落序号，文档内从 1 起。 */
  para_index: number;
  /** 以下为 anchor.go 校验通过的字符区间（含起、不含止）。 */
  char_start: number;
  char_end: number;
}

/** 检索 lane 分数：dense/sparse/multi 三段必填，rerank 可选第四段。 */
export interface EvidenceLaneScores {
  dense: number;
  sparse: number;
  multi: number;
  rerank?: number;
}

export type EvidenceLane = "dense" | "sparse" | "multi";

/** 单条证据：定位 + 原文摘录 + lane 分数（可解释性折叠区数据源）。 */
export interface EvidenceItem {
  locator: StructureLocator;
  quote: string;
  lanes: EvidenceLaneScores;
}

/** EvidencePack 候选：一个 doc 聚合 RRF 融合分与主 lane。 */
export interface EvidencePackCandidate {
  doc_key: string;
  title: string;
  revision_id: string;
  /** RRF 融合分，等宽数字右对齐展示。 */
  rrf_score: number;
  /** 主导 lane，用于三色徽章。 */
  top_lane: EvidenceLane;
  evidence: EvidenceItem[];
}

export interface EvidencePackUI {
  search_id: string;
  candidates: EvidencePackCandidate[];
}

/** 结构树标题节点：可折叠/展开；level 1..6 对应 16px/级缩进。 */
export interface DocStructureHeading {
  kind: "heading";
  level: number;
  title: string;
  /** 稳定锚点 id，用于命中高亮与锚点跳转。 */
  anchor: string;
  children: DocStructureNode[];
}

/** 结构树段落节点：doc 级，不渲染 chunk，仅显示首行截断。 */
export interface DocStructureParagraph {
  kind: "paragraph";
  para_index: number;
  first_line: string;
}

export type DocStructureNode = DocStructureHeading | DocStructureParagraph;

export interface DocStructureTreeUI {
  doc_key: string;
  title: string;
  revision_id: string;
  nodes: DocStructureNode[];
}

/** Lint 待办类型（C-15 消费）：矛盾 / 孤页 / 缺引用 / 过时。 */
export type KnowledgeLintKind = "conflict" | "orphan" | "missing-citation" | "stale";

export interface KnowledgeLintTodo {
  id: string;
  kind: KnowledgeLintKind;
  summary: string;
  /** 涉及页 doc key，链接到 /knowledge/{page_key}/read。 */
  page_key: string;
  page_title: string;
  /** RFC3339 检出时间。 */
  detected_at: string;
}
