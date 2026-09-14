# 知识工作台产品客户端

背景 BG-2026-09-13-r2；任务 WS03-B 和知识域所需 WS03-A 接线；H02 消费、H03 产品写入、H06 由 RTW 映射。独立工作树基线为网页视觉交付
`0a5495325c299b36780098ed6910b09327a0033f`。本次按照最新推送要求交付当前阶段，不声明完整知识工作台已经验收。

## 已实现

- `/workbench/modules` 读取管理员草稿列表、创建模块；公开 `/knowledge`
  仍只消费已发布列表。原知识工作台入口保留。
- 通过真实 RTW 接口保存 UTF-8
  Markdown/文本原文、不可变 Wiki 修订、具体原文修订和 `paragraph:N`
  来源；本次编辑提交后可以继续追加新修订，写入携带基准修订与幂等键。
- 提交编制、冻结候选、创建/取消构建、取消编制，以及手动发布命令。发布绑定 release/build/expected_pointer_revision/reason；服务回执为 READY 才提供发布操作。
- 命令失败保留输入与重试身份。NOT_BUILT、BUILDING、FAILED、CANCELLED、SUPERSEDED 和未知状态分别显示；编制 ACCEPTED 与构建 READY 分开解释。任务受理不等于 AI 编制完成或知识发布。
- 明细只显示本页真实收到的回执，最新候选状态与发布指针支持人工刷新。后端缺失明细不能用示例填充。
- 原主题、社区与账号源码保持不变，显式设计 demo 继续独立使用。新真实模式不回退示例。

## 明确未完成

当前提供方产品 API 尚缺少管理员历史 release/build/compile 列表、逐修订正文读取和公开固定修订正文读取。因此历史编辑入口禁用；修订比较显示元数据和正文缺失说明；编制持续轮询、完整候选/构建历史、跨刷新回滚选择与正式知识阅读仍待 H02 读面交接。回滚命令客户端已实现并通过真实 BFF 验证，但完整历史版本选择 UI 尚未验收。

不从网页代理
`/internal/v1/knowledge`，不在浏览器接纳 worker 结果。真实编制模型、三路编码索引、发布后搜索版本验证、S3、实际统一身份角色映射和生产部署未验收。索引配置须由搜索提供方给出，界面不自动填入虚构模型空间。

## 契约同步

权威源为 RTW `api/knowledge.api`。`generated/knowledgeComponents.ts` 复制 goctl
TypeScript 类型，`routes.json` 从 Swagger 提取产品路径和方法；不包含 internal
worker。源 SHA 与 API hash 见
`generated/source.json`。生成后的 Prettier 格式归一化由脚本执行，不手改生成物。

```sh
node scripts/sync-knowledge-contract.cjs /path/to/rtw-checkout
```

服务器配置 `SEA_PRODUCT_API_SERVER_URL` 指向 RTW 服务根地址（不带
`/v1`）；沿用登录用户 JWT。管理员由 RTW 判定。BFF 保留业务 HTTP 状态与 envelope，并贯通取消信号。未配置返回 503，非产品路径/方法返回 404。

## 2026-09-14 阶段验收

- 类型检查通过；Node 22.22.0 下 Next
  16.1.3 生产构建、62 个静态页面及 standalone 静态资源准备通过。
- 43 项 Node 定向测试通过，包括生成路由、不可变写入字段、幂等键、409原样透传、六种构建状态、缺正文禁止编辑、实际工作台组件及既有学习流回归。
- 新知识 feature、BFF 与路由的 scoped
  ESLint 无错误；原设计页保留4条原生SVG图片优化提示。新 CSS Stylelint 与 git
  diff whitespace 检查通过。未声称全仓 lint 通过。
- 脚本启动独立 PostgreSQL、实际 go-zero 服务、生产 Next
  BFF 和本地内容寻址对象，完成书 A 初版、修改 Wiki、加入书 B、人工发布/幂等重放/409拒绝、回滚旧 READY 版本。公开列表与草稿列表分离。结构 fixture 明确不证明真实三路索引效果。
- 实际浏览器完成草稿模块创建、原文保存、带来源 Wiki 保存；另从现有结构 fixture 版本 v1 手动切换 v3，实际指针由4增加到5。缺正文入口保持禁用，页面如实显示未完成项。

结构化记录：[`acceptance/knowledge-20260914.json`](../../../acceptance/knowledge-20260914.json)。完整 WS03-B 的搜索/真实模型 L3 接纳仍未完成。本次无部署。

复现（先生产构建，再启动；仅创建随机端口的独立本地数据库）：

```sh
node --test tests/knowledge-contracts.test.cjs tests/sea-contracts.test.cjs
pnpm typecheck
pnpm build
KNOWLEDGE_PG_BIN=/path/to/postgresql/bin node scripts/knowledge-acceptance.cjs /path/to/rtw-checkout
```

`KNOWLEDGE_KEEP_RUNNING=1`
可保留临时本地服务供人工 UI 验收；结束后向验收进程发送 SIGINT/SIGTERM，脚本停止自己的 Go、Next 和 PostgreSQL。日志与随机测试凭据只留在临时目录，不提交或推送。
