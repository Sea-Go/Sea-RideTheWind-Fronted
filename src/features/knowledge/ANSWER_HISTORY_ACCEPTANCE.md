# 已接纳知识问答历史读面

状态：WS03-C
**局部实现并完成前端合同验收**；H02 整体仍为 PARTIAL。此页读取 RTW 已接纳的产品答案，不读取 tRPC-Agent-Go 原始 Session。前端消费的权威合同固定在 RTW
`55a0ec2c8aaca3b658832a1b8d93f90c628f8b04`，生成来源和 `api/knowledge.api`
SHA256 见 `generated/source.json`。

## 产品行为和边界

- 书架提供“已接纳问答”入口。`/knowledge/answer-sessions`
  接受已有逻辑会话 ID；会话页按 `accepted_ordinal`
  正序分页，答案页按 AnswerID 回查。同一用户换账号后页面按 JWT 重新装配，不沿用旧账号的组件状态。成功和证据不足分别显示，空会话、未登录、加载、网络/身份错误都有显式状态。
- 列表逐条校验已接纳历史。较早的结构不匹配记录单独标为暂不可读，不遮蔽同会话其他已验证答案；如果全页都不匹配，不显示“暂无答案”的误导提示。固定 AnswerID 详情仍严格拒绝不匹配的主体、会话和引用，不把被跳过记录的正文或旧摘录展示出来。
- 仅调用 RTW User JWT 产品 GET
  `/v1/knowledge/answer-sessions/:session_id/accepted-answers`、`/:answer_id` 与
  `/:answer_id/citations`。浏览器只提交会话 ID、AnswerID、`limit` 和
  `after_ordinal`；不提交 SubjectRef。BFF 沿用已有 User Center
  token 转发并原样保留上游状态/envelope；此路径不从管理员 Cookie 取令牌。`internal/v1/knowledge/accepted-answers`
  不进入浏览器路由表。
- 页内回答标为**当时已接纳的历史记录**。列表不逐条调用引用状态，而是引导进入固定答案详情；详情向 RTW 用户态元数据接口读取本答案**实际引用**的
  `available/unavailable`，核对 AnswerID、SearchID、完整 SubjectRef、状态、module/release/发布指针版本、引用顺序及 content/revision/locator/quote
  hash/原始对象。`unavailable`
  时隐藏旧 quote 和来源链接；状态请求失败或身份不一致时只保留历史答案并显示“当前可用性未核实”。`available`
  的固定来源链接绑定原
  `module_id + release_id + revision_id + locator`，公开阅读接口仍负责按 404/410 判断实际阅读；不回退到当前活动版。
- 当前 `/learn` 的既有学习对话由另一路 `learning/conversations`
  服务维护，尚未提供与 BTW/RTW 逻辑知识问答会话的权威映射。入口要求输入已知会话 ID，不把现有 conversation
  ID 猜作知识会话 ID，也不伪造实时流。

## 工作区域和交接

`[W0]` 独立干净工作树 `feat/knowledge-product-answer-history-20260914`；`[W1]`
前端知识 feature、三个知识历史页面、知识书架入口、既有 Sea
BFF 的用户 token 分支、生成产品合同、定向测试与本文；`[R1]` RTW
`api/knowledge.api`、生成 TypeScript/OpenAPI、知识服务文档与 BTW
`AcceptedRootTurn`；`[D1]` Next 16.1.3、React 19.2.3、pnpm 锁文件；`[G1]`
`src/features/knowledge/generated/` 只用
`scripts/sync-knowledge-contract.cjs <RTW checkout>`
从权威 DSL/生成物刷新；`[X1]` 无外部写入；`[N1]`
原始脏树、RTW/BTW 服务代码、worker token、生产；`[T1]` 本地 `node_modules`
和 Next 构建输出，均不提交。

RTW 已在上述固定提交提供按已登录主体、session、AnswerID 的**产品引用当前可用性投影**，只给引用 ID、固定定位与可用性，不给旧 quote 原文，也不向网页开放 worker
token。后续需由产品/搜索链路给出真正的用户逻辑知识会话 ID 到此页的入口，并对已接受答案的公开搜索结果、同会话续问和实际用户权限做端到端验收。

## 验收记录

在本独立分支执行：

```sh
node scripts/sync-knowledge-contract.cjs /Users/edy/Sea/.codex-worktrees/sea-rtw-knowledge-20260914
node --test tests/knowledge-answer-history.test.cjs tests/knowledge-contracts.test.cjs tests/sea-contracts.test.cjs
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

生成路由新增三个 User
JWT 产品 GET；67 项 Node 定向/回归测试通过，覆盖 BFF 不借用管理员 Cookie、上游 401 保留、会话/分页/AnswerID/引用状态 URL、成功/证据不足解码、当前撤回状态与旧引用冲突拒绝、固定跳转、错会话与伪造引用拒读。类型检查通过。全量
`pnpm lint`
退出 0（仓库既有 66 条 warning，未改动其他文件去清零）；本机运行时 Node
26.3.1，仓库声明 Node
22.22.0；Next 生产构建通过并产生 63 个预渲染静态页面。使用 CUA 在本机 Codex 内置浏览器打开独立 Next 开发服务器，入口表单和提示排版可见；提交模拟会话 ID 后，既有登录代理正确转至
`/login?next=...`。RTW 自身有独立真实 go-zero HTTP、User RPC、隔离 PostgreSQL
16 的产品读及撤回反例测试；本分支尚未与那些进程做同一次浏览器到数据库联验，也未验真实登录账户/部署。因此不把本次页面或合同测试记为 H02 整体验收。

2026-09-15 当前Web开发集成头增加逐条隔离测试：早期不匹配record加新有效answer时，列表只显示新答案并报告旧记录数量；固定详情对不匹配record仍拒绝。该测试与真实浏览器同次链均通过，浏览器在来源撤回后回到`search-facade-session`列表，看到3条暂不可读提示和第4条可查看的`Evidence`答案卡；随后固定详情仍显示`已撤回或不可用`且隐藏旧摘录/链接。完整同次报告及SHA见[搜索入口验收](PRODUCT_SEARCH_ACCEPTANCE.md#验收记录)。这证明本机产品读面不会被一条旧结构记录整页阻断；旧记录本身尚未完成格式迁移，也没有上线或跨浏览器验收。
