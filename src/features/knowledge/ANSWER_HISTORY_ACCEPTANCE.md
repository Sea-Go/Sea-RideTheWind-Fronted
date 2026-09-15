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

2026-09-15 的 SubjectRef v2
**消费者先行局部交接**：Web 产品历史响应在生成 SDK 之外定义两版主体适配，旧三元组仅接受
`rtw.identity/platform/<规范正整数UID>`；新结构仅接受
`{issuer:"rtw.identity",subject_id:"<UID>"}`，`platform`
不代表实际租户。列表逐条把外层主体与不可变 `turn_json`
中的主体规范化后比较；外层 v2 加原始 v1
turn、纯 v1/v1、纯 v2/v2 均可读；不同 UID、错 issuer、额外字段、非规范/超 int64
UID 拒读。固定详情保持整条严格门禁。历史 GET 的原始 envelope 和 turn 的 JSON 解码拒绝重复对象键，避免
`JSON.parse`
把冲突字段覆写后再比较。请求仍只发 session/AnswerID/分页，不由客户端签发主体；不手改
`generated/`，也不改 RTW 已接受历史的原文/hash。

从独立干净树的 `46e9998` 完整执行 `node --test tests/*.test.cjs`：84 pass、0
fail；`pnpm typecheck`、变更五个源码文件的 ESLint（0 error、0
warning）、`pnpm exec next build`（63个静态页面）与 `git diff --check`
通过。当前 Node26.3.1 与声明 Node22.22.0 不同，构建工具打印引擎警告；本项只使用本地 v1/v2 响应夹具，没有实际 RTW
v2 生产者、数据库双投影、五仓同轮迁移、真实 v2 用户浏览器或部署证据。原有 v1 实际浏览器 L3/L4 报告继续按其固定提交解释，不能借它宣称 v2 浏览器已验。

## 2026-09-15 版本化历史读候选

Web 候选固定开发集成基点 `28096d532fdf7a1117639ef3c344c74a96a96f95`，独立分支
`feat/knowledge-v2-history-candidate`。`/api/sea/knowledge/...`
的正式历史页面默认仍走 RTW `/v1`；只有服务端在隔离本机验收中显式设置
`SEA_KNOWLEDGE_HISTORY_READ_VERSION=v2`，三条
`answer-sessions/:session_id/accepted-answers` 的 list/detail/citations GET 才走
`/v2/knowledge`。配置为其他值时历史读返回明确 503。浏览器没有版本选择或主体参数入口；v2
BFF 只接受 list 的
`limit/after_ordinal`，拒绝重复分页键、`version`、SubjectRef 字段以及 detail/citations 的 query。v1
BFF 保持旧 query 原样透传，RTW 仍只按 User JWT 决定历史主体。v2 无 User
JWT 本地 401，不借管理员 Cookie/Worker
token；已认证请求保留 RTW 上游 401/404 等 HTTP 状态和原始 envelope，不开放 v2 写入、管理、SSE 或任意代理路径。

v2 DTO 和三条 GET 路由只由
`node scripts/sync-knowledge-contract.cjs <RTW checkout> --v2-history-only`
从固定 RTW `bedaa02d0fa587a5e9f798b8ff9f42c800f98e3e` 的
`api/knowledge.api`、goctl 1.9.2
Swagger/TypeScript 生成物同步。`generated/source-v2-history.json` 锁定 DSL
SHA256 `0cc506d50784348ab2ed4a4012bb5182f25a0e3e5ae65b4690d67536325b91a9`
及原生成 TypeScript SHA256
`4c939cd48f13622730563e137420db5564dceebacca27ee1951ed88b488f2581`。同步脚本按 TypeScript
AST 提取五个历史 v2 DTO 及依赖，未手写生成字段；旧
`knowledgeComponents.ts/routes.json/source.json`
相对 Web 基点逐字不变。引用当前状态响应也在客户端严格拒绝重复 JSON 键；如同一引用有相冲突的
`unavailable/available`，详情页在核验前不展示旧摘录和来源链接。有效 v1/v2 引用状态仍按原固定元数据核对。

本候选的 L1/L2 包括生成重跑零差异、旧 v1 三份生成文件原字节不变、88 项 Node 定向/回归测试通过、`pnpm typecheck`、`pnpm lint`
与 `pnpm build`
退出 0；全仓 lint 的既有 66 条 warning 不在改动文件。测试运行于 Node
26.3.1，仓库声明 Node 22.22.0。早期本机隔离 PostgreSQL、真实 User Center、RTW
HTTP、两套 Next BFF 的第二轮业务断言和 RTW
Go 测试虽通过，Web 协调进程却因旧定时器最终退出 143，不能记整轮 L3
PASS；第三轮在 User RPC race 链接时遇 ENOSPC，未启动 HTTP，也不能记通过。

最终从 Web 当前开发集成代码 `caca51f41692cf0b6a3b8cc936a1723b1372fa84`
和 RTW 知识集成 `730d16198b871ad8f26984f2f33361f5ca13f0c6`
执行[可重跑脚本](../../../scripts/knowledge-v2-history-live-acceptance.cjs)，脚本字节 SHA256 为
`36532056bc6518ecbf9d7ffdc0a09081d0e2636cea95d32ef243a951fc05453d`；本轮按测试默认路径重新编译 User
RPC/API race 与当前 Knowledge HTTP，再启动两个生产 Next
BFF，一个维持 v1、一个服务端显式 v2。顶层退出 **0**，报告
`/var/folders/f_/l5hv3b1d6sx8zwr_cc8fkjkm0000gn/T/sea-web-v2-history-live-6GmmcD/report.json`
SHA256
`395551b92ca12522f9e9d5f719f14bb29cb9dd7e474082686524a2207de2e752`；本人两版列表/固定详情均200，新版外层仅 issuer+UID、内层旧v1
turn逐字同旧版；第二 UID 自己有一条答案，但按主人固定AnswerID在v2隔离404，缺 User
JWT
v2为401。本人引用先 available，RTW 撤回后同一固定答案详情原 v1响应字节不变、v2
turn不变，v2引用改为unavailable。RTW真 User Center Go 测试 PASS；隔离 PG
`pg_ctl status`退出3、两个 Next 测试端口无监听，Owned进程均停。本次是**两仓真实User
Center/PG→生产Next BFF
HTTP 的L3子链**，还未在真实浏览器DOM/桌宠窗口操作v2、未验证四仓搜索/Tools的同轮v2业务写流，生产旧行preflight、默认用户切v2和部署均未完成。
