# 引用-定位（Citation / Locator）读面验收

状态：FE 引用轨 `feat/citation-ui-20261006`
**组件与骨架落地**；structure/lint 后端端点**未就绪**，页面数据为 mock，端到端验收待后端。

## 交付范围

- `CitationCard.tsx`：单条引用卡。doc 标题 + revision 徽标（mono 小字）+
  section_path 面包屑（12px muted，`›` 分隔）+ para 锚（`#P12` 上标样式）+
  quote 块（mark 底色 + 3px 左边框 + 衬线/斜体）+
  lane 分数折叠区（等宽数字，dense/sparse/multi 三段小条形，rerank 可选第四段）+ 低相关告警条（warning 语义色，不隐藏内容）。hover 边框加深 +
  `translateY(-2px)`；点击整卡（或 Enter/Space）触发
  `onOpen(docKey, locator)`。`compact` 紧凑态供面板复用（quote 两行截断）。
- `EvidencePanel.tsx`：EvidencePack 候选列表。每候选一行（doc 标题 +
  RRF 分数等宽右对齐 + lane 三色徽章），展开（200ms 高度过渡）显示其 evidence
  Locator 列表，条目复用 CitationCard 紧凑态；列表标题 13px
  uppercase；空态文案。
- `StructureTreeViewer.tsx`：结构树浏览。接收 generated
  `DocStructureTree`，16px/级缩进；标题节点可折叠/展开（150ms，grid-template-rows 过渡），段落节点显示首行截断；命中行 accent 左边条 + 选中底色；标题行为
  `<button>`，天然 tab + Enter 键盘可达；容器
  `max-height: 420px` + 滚动，行高 32px。
- `LintTodoList.tsx` +
  `src/app/knowledge/lint/page.tsx`：Lint 待办页骨架。类型徽章（矛盾/孤页/缺引用/过时）+ 涉及页链接（`/knowledge/{page_key}/read`）+ 处置按钮占位（disabled，title 注明端点未就绪）。
- 接线：`src/app/knowledge/[id]/read/page.tsx`
  加 StructureTreeViewer 侧栏，props 传 mock 结构 JSON（`demo-fixtures.ts`），注明待后端端点；演示与正式阅读两条路径（`KnowledgePages.tsx`
  DemoKnowledgeReader / `PublishedKnowledge.tsx`
  PublishedReader）均渲染侧栏并带“演示结构 · 待后端端点”说明。
- `api-paths.ts` 增 `KNOWLEDGE_V2_PATHS`（docStructure /
  lintTodos，注释标注“后端未就绪”）；组件不硬编码 URL。
- `generated/structureComponents.ts`：StructureLocator / EvidencePack /
  DocStructureTree /
  KnowledgeLintTodo 类型唯一来源（组件只 import，不手写同名结构）。**轨道说明**：F1（chat 流式）轨独立建同内容文件，合并时二取其一（文件头已注明）。

## 视觉令牌落实（对齐《前端视觉规范研究依据》§B/§E）

- 全部走 `--sea-*` 主题令牌（`sea.css`
  data-sea-theme 三主题可切），**零硬编码 hex**：
  - 卡底 `--sea-panel`、边框 `--sea-line`、hover 边框 `--sea-orange`（accent）；
  - quote 底 `--sea-butter`（mark 语义）、左边框 `--sea-orange`；
  - 低相关告警 = butter 底 + orange 边（与 `sea-notice.error`
    同一 warning 语义）；
  - lane 三色徽章 dense/sparse/multi =
    sage/blue/butter（徽章带文字，不单靠颜色区分）；
  - 结构树命中 = inset 2px orange 左边条 + sage 底。
- 动效只用 transform/transition（hover 抬起 2px、150ms 折叠、200ms 展开、200ms 条形宽度）；`prefers-reduced-motion: reduce`
  时全部冻结为直切，hover 不再位移。

## 验收记录

在独立 worktree `/tmp/web-wt-cite`（分支 `feat/citation-ui-20261006`，基线
`acb92c6`）执行：

```sh
pnpm exec tsc --noEmit   # 通过（0 error）
pnpm build               # 通过（next build + prepare-standalone）
```

本地操作验收（dev 环境，三主题 mountain/planetarium/summer）：

1. `/knowledge/mountain/read`：左栏出现“结构树”侧栏（演示 JSON 标注），01 节命中高亮（左边条）；标题行 tab 聚焦、Enter 折叠/展开 150ms；段落行首行截断；容器超高滚动。
2. `/knowledge/lint`：四类徽章各一条占位数据；涉及页链接指向
   `/knowledge/{page_key}/read`；处置按钮禁用并提示端点未就绪；空列表走
   `sea-empty` 空态。
3. CitationCard/EvidencePanel 为纯组件（暂无页面入口，chat 轨接线）：低相关样例三 lane 均 <
   0.35 时告警条出现且 quote 不隐藏；分数折叠区四段（含 rerank）渲染等宽数字。
4. 键盘走查：Tab 顺序 = 候选行 → 卡片 → 折叠按钮；Enter/Space 均可触发；focus-visible 沿用
   `sea-app` 全局 outline。

## 边界与遗留

- **后端未就绪**（`KNOWLEDGE_V2_PATHS`，`api-paths.ts`
  已登记）：structure/lint 端点上线后，`demo-fixtures.ts`
  删除、页面改为端点读取，`generated/structureComponents.ts` 由
  `scripts/sync-knowledge-contract.cjs` 刷新。
- read 页命中高亮暂为固定 `activeAnchor="section-1"` 演示；端点就绪后与
  `?locator=` 查询联动（Locator → 段落锚滚动 + 高亮，滚动 300ms 见规范表）。
- EvidencePanel/CitationCard 的页面入口由 F1
  chat 轨（引用侧栏）接线；两轨合并时组件以本轨为准。
- Lint 处置动作（接受/驳回/转工单）待 C-15 后端裁决端点，按钮保持占位禁用。
- tsc 依赖 gitignored 的
  `next-env.d.ts`（worktree 需本地生成，已确认非本轨引入）。
