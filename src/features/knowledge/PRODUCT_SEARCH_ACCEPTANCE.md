# 已登录知识会话搜索入口

状态：**LOCAL_VERIFIED（2026-09-14）；真实 Next BFF
HTTP 跨仓链 INTEGRATED（2026-09-15）**。前端与 RTW H02 产品合同、Next
BFF 转发和现有已接纳答案读面完成本地合同验收；真实 User
Center、Next 生产服务、RTW、BTW 正式
`cmd/api`、DataCenter 固定 BGE-M3 三路表示及 RTW
PostgreSQL 已在同一次 HTTP 联验中通过。真实浏览器 DOM/视觉、线上模型和规模效果仍未验收，H02 整体仍为
**PARTIAL**。

## 产品流程和边界

从正式知识模块页“向这个知识模块提问”进入问答入口，模块 ID 预填。用户可创建新的逻辑知识会话，或输入已有会话 ID 续问；当前
`/learn`
的学习对话没有权威映射，不复用其会话 ID。已登录会话页提供模块 ID、问题、快搜/详搜、低/中/高四个输入；浏览器使用
`crypto.randomUUID()` 建立符合 RTW 格式的幂等键，只向
`POST /v1/knowledge/answer-sessions/:session_id/searches`
发送这五个字段。SubjectRef、SearchSnapshot、SearchID、AnswerID 都由服务端确定，浏览器不从客户端身份或页面版本推断。

SubjectRef 的产品身份语义只有 **RTW User Center（`rtw-user-center`）权威来源 +
User Center 全局 UID**。后端现有三段编码 `rtw.identity/platform/<UID>`
中，`platform` 是固定 realm 常量，不是租户；网页不新增、保存或发送
`tenant_id`，也不根据域名、模块或会话推断租户。

RTW 返回 202 时，网页每 3 秒 GET 固定 `search_id`；503 或 GET 的
`retryable_failure`
时，原正文与原幂等键重投 POST，也可先 GET 固定操作。网络中断及无操作 ID 的响应仍保留原键。待处理请求在当前标签页的
`sessionStorage`
中保存，并用当前用户 JWT 的 SHA-256 摘要区分账号；页面重载后有 ID 先 GET、无 ID 等用户同键续试。它只保证同一标签页和同一 JWT 下的恢复，不保证跨设备或登录令牌轮换后的页面恢复。409 异文冲突停止旧键重试，由用户显式新建搜索；前端不会悄悄改写该键的请求正文。200 仅对
`succeeded/insufficient`
跳转到 RTW 返回的固定 AnswerID 详情，详情再由已有历史/引用状态读面读取和验证；`retryable_failure`
即使 HTTP 200 也不展示为答案。不会把 BTW 原始 Session 或未接纳文本作为产品答案。

答案详情的当前引用状态由 RTW 用户态 `/:answer_id/citations`
投影决定。`unavailable`
时既有详情读面隐藏旧摘录和原文链接，仍保留“当时已接纳”的历史记录；状态请求失败或身份/引用不一致时标示“当前可用性未核实”。这部分读面在此前前端合同测试中覆盖，**本次搜索入口测试没有用真实撤回来源跑浏览器到 RTW 数据库的联验**。

浏览器调用 `/api/sea/knowledge/...`，BFF 的路由来自 RTW `api/knowledge.api`
生成物。BFF 保留上游 200/202/503、正文、User
JWT，不从管理员 Cookie 借权。生成来源固定在
`generated/source.json`；当前源 RTW 提交
`5b08a8bb9bcb1e5add16c3e82fb684a738d33327`。没有将 RTW 私有 Worker 或 BTW 签名头暴露给浏览器。

## 工作区域与交接

`[W0]` 独立干净工作树 `feat/knowledge-product-search-web-20260914`；`[W1]`
知识会话页、模块入口、产品搜索客户端、生成合同、局部测试与本文；`[R1]` RTW
H02 的产品搜索接受与恢复合同、现有答案历史读面；`[D1]` Next 16.1.3、React
19.2.3、pnpm 锁文件；`[G1]` `src/features/knowledge/generated/` 只由
`node scripts/sync-knowledge-contract.cjs <RTW checkout>` 更新；`[X1]`
仅推本分支，无服务部署；`[N1]`
原始脏树、RTW/BTW 代码、Docs、用户 JWT、正式环境；`[T1]` 本地
`node_modules`、Next 构建输出均不提交。

## 验收记录

执行
`node --test tests/knowledge-product-search.test.cjs tests/knowledge-answer-history.test.cjs tests/knowledge-contracts.test.cjs tests/sea-contracts.test.cjs`、`pnpm typecheck`、`pnpm lint`、`pnpm build`、`git diff --check`。75 项 Node 测试通过，包含五字段 POST 与用户 JWT、503 固定 ID、202/200
GET 回查、409、伪成功拒收、成功 AnswerID、当前标签页同账号恢复和 BFF 状态/正文转发。类型检查与 63 页 Next 构建通过；全量 lint 退出 0，仓库原有 66 条未改文件的 warning。测试机器 Node
26.3.1，项目声明 Node 22.22.0；未用正式版本 Node 重验。

2026-09-15 运行
`node scripts/knowledge-live-search-acceptance.cjs <RTW> <BTW> <DataCenter>`，同一次真实进程链完成两账号 User
Center 登录、生产 Next 页面路由与 BFF、产品 POST、同键重放、固定 GET 恢复、另一 UID 隔离、RTW
PG 答案/引用/历史读取，以及来源撤回后的 `available→unavailable`。BTW 使用正式
`cmd/api` 和 tRPC-Agent-Go Graph/Runner，DataCenter 使用固定官方 BGE-M3
Dense/Sparse/Multi-vector 表示与三路本地精确检索。最终报告
`/private/tmp/sea-web-live-search-final-pass-20260915113215-51465/report.json`
为 `passed`，SHA256 为
`3fb132882ac876aa8b4c6a15e0d6f49198198f4b273b48af7db4d2e73974d144`；RTW/DataCenter 子进程与脚本均退出 0，且没有残留联验进程。报告不含 JWT、口令、DSN 或签名密钥。

这次只把生产 Next 页面路由壳作为 HTTP 证据；登录态页面内容和 `sessionStorage`
依赖客户端水合，没有把原始 HTML 误写成浏览器验收。未运行真实浏览器 DOM/视觉；固定模型和两块隔离语料也不验证模型答案质量、检索相关性、规模效果、客户端 SSE/Tools 或生产部署。
