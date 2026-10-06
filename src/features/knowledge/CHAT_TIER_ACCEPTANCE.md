# Chat 流式对话页（tier 选择 + 流式渲染 + BFF 透传）

状态：**LOCAL_VERIFIED（2026-10-06）**。三组件（类型镜像 / ChatTierSelector /
ChatStream）与 `/chat` 页面骨架、`/api/chat`
BFF 已完成本地构建与契约验收；真实 A1 `/api/v1/chat`
上游尚未实现，端到端流式联验待上游交付后补（见“边界”）。

## 环境与配置

- Node 22 / pnpm 10；`pnpm install` 后执行：
  - `pnpm exec tsc --noEmit`
  - `pnpm lint`（eslint + stylelint）
  - `pnpm build`
  - `node tests/knowledge-contracts.test.cjs` 等仓内 `tests/*.test.cjs`
    （与本次改动相关的既有合同测试全绿）。
- 后端：`SEA_PRODUCT_API_SERVER_URL` 指向产品服务根地址（不带
  `/api/v1`）。未配置时 `/api/chat` 返回
  `503 {"code":503,"msg":"产品服务尚未配置，请设置 SEA_PRODUCT_API_SERVER_URL","data":null}`
  （沿用 `/api/sea/[...path]` 先例）。
- 契约快照（§1）：类型手工镜像自 BTW
  `service/search/rpc/internal/evidence/types.go` 与 RTW
  structure 契约，字段与 JSON tag 逐一对应；待 RTW generated 下发后整体替换
  `generated/structureComponents.ts`，消费方 import 路径不变。

## 验收步骤

1. `pnpm build && pnpm start`（或 `pnpm dev`），浏览器打开 `/chat`。
2. 档位选择器：三段（快答/均衡/深查）可见，各含一行说明；默认档由页面props 传入（当前 D12 冻结值未下发，页面取
   `balanced`）。
3. 输入问题回车发送：用户消息立即以右侧 primary 气泡出现；AI 回答以无气泡底的文档流左对齐增量呈现，末尾带块状打字光标。
4. 断开网络（DevTools
   Offline）制造流中断：状态行出现“正在重连”，恢复网络后自动续流，已显示段落不重复。
5. 点击回答中的 `[n]` 上标角标：右侧引用侧栏对应占位卡高亮。
6. 系统开启“减少动态”（DevTools Rendering → prefers-reduced-motion:
   reduce）：光标静止、渐隐入场与 200ms 过渡全部退化为直切。

## DOM 断言

- 档位选择器：`[role="radiogroup"][aria-label="问答档位"]` 下 3 个
  `[role="radio"]`；active 段 `aria-checked="true"` 且类含
  `bg-primary`；容器类含 `bg-muted`；键盘 ←/→/↑/↓ 可换档。
- 消息列表：`[role="log"][aria-live="polite"]`；用户气泡类含
  `bg-primary text-primary-foreground`；AI 消息容器无气泡底类。
- 消息间距：`.chat-stream-list { gap: 24px }`（chat-stream.css）。
- 打字光标：流式中最后一条 AI 消息末尾存在
  `span.chat-stream-caret`；`@media (prefers-reduced-motion: reduce)` 下该元素
  `animation: none`。
- 引用角标：`button.chat-stream-citation[aria-label="查看引用 n"]`，点击触发
  `onViewCitation(n)`；侧栏对应 `li[data-citation-slot="n"]`
  高亮（`aria-current="true"`）。
- BFF：`curl -X POST /api/chat`（未配置上游）→ 503 envelope 同上；
  `curl /api/chat`（GET）→ 405 envelope。

## 边界与已知遗留

- A1 `/api/v1/chat`
  未实现：BFF 对上游 404/501 原样透传，ChatStream 以 error 横幅呈现并允许显式重试；重试沿用既有回合（不重复追加用户问题、保留去重集合与
  `after` 游标）；不伪造流式内容。
- 引用侧栏为占位（CitationCard / EvidencePanel 未在本任务范围）；
  `collectCitationNumbers` 只收集 assistant 正文（跨 SSE 分片拼接后）出现的
  `[n]` 编号，不与EvidencePack 候选对应——待引用下发接口接入后替换。
- 断线重连：客户端按 `(message id, seq)` 幂等去重并携带 `after` 游标重发；`seq`
  缺失的增量不去重、按到达顺序直接追加（无文本兜底去重）。EOF 未收到 done 事件同样按中断走有界重连。上游重放语义（是否支持 after 续传）待 A1 契约冻结后复核。
- tier 文案唯一来源为 `generated/structureComponents.ts` 的
  `CHAT_TIER_DEFS`（规范 §2.4 条款 6）；默认档 D12 冻结值下发后改页面常量
  `DEFAULT_CHAT_TIER` 一处即可。
- 组件只消费语义令牌（`--primary`/`--muted`/`--ring` 等 Tailwind 语义类或
  `var(--*)`），未硬编码色值；三主题（mountain/planetarium/
  summer）与暗色模式由令牌自动适配。
