# Wiki 单事实人审：客户端与本机验收

源合同固定为 RTW
`feat/wiki-quality-human-judgment-20260916@6865022bdf73c49934705849e16b62660cb4c238`，`api/knowledge.api`
SHA-256
`b34068390b94e768775e17fb471b43c95f1772dcfdb7e1d221cdf2fa926e9f27`。Web 只通过
`scripts/sync-knowledge-contract.cjs <RTW checkout>` 复制 goctl
1.9.2 类型和产品路由；`generated/source.json`
留源提交与 DSL 摘要，未代理 private Worker Event 路由。

工作台“事实核验”先选择**一个固定 Wiki 修订**，读取该修订已有事实判断、当前正文编辑 head 和活动 Release。三者各自从 RTW 产品 API 回读；历史 Wiki 修订可以作为目标，评阅 POST 只推进
`(wiki_revision_id,fact_id)`
的独立判断 head，不编辑 Wiki 正文，也不自动发布。事实 ID 由 RTW 对原文修订、`paragraph:N`
和精确原文字串摘要派生，Web 从不提交 FactID。Web 单独读取固定 Wiki/Source 正文，先按原 UTF-8 内容核 SHA-256，再从原文段落逐字取 SourceQuote、从 Wiki 正文逐字取可选 WikiClaim；保留 CRLF 和空白。服务端再核真实字节、来源链与引用。

维护请求和质量 GET/POST 显式带当前管理员会话。BFF 对质量与编辑 head 的 cookie 回退只选
`admin_center_token`；既有公开书架和知识答案历史仍按原 User 会话路径。RTW 当前评阅者只由
`Auth` JWT `userId` 加 `AdministratorIDs`
名单确定，界面只写“管理员账号标识”；没有实时 UserCenter 撤销/资格核验。一次人审仅是一个 Fact 在一个 Wiki 修订上的
`0–3` 或
`undetermined`，不能推断页面 FactSet 已列全、D07 已达标或允许自动 Release。缺失/冲突为 0，覆盖为 1–3，2–3 必须有精确来源修订与段落引用；无法判定不打数字分。重判从已列表回执带
`base_judge_revision_id`，409 保留证据和理由，刷新后由管理员重新核对。

撤回 Source 的固定正文读面返回不可用，证据选择器不会展示假原文，也不会打开新提交；此前的质量标签仍可按固定 Wiki 修订列表回读。选择目标 Wiki 和取可提交证据是两个步骤：原文字节不可读时，新的证据不能提交，旧回执仍可查。成功提交会清空理由，防止重复点击追加同一判断。

## 本机证据

- 固定 Web 源提交 `4eea79ff3ee9fe7da70e536ad327868eac0c5bfe`
  的 70 项受影响 Node 合同/组件测试通过，test.log SHA-256
  `c6eca80a9be69b1e5860b366663ab3106e7e6aff5f9737a4cb8f324d4be75b22`；TypeScript 类型检查、scoped
  ESLint/Stylelint 和 Next 16.1.3 生产构建通过，build.log SHA-256
  `4395d9f08e2d618948009e55ca06e50a5bc5f9a20674e82f478cf29eae84e9f1`、BUILD_ID
  `TcHnEnQdLvwjOfh7hzIxR`，构建生成 63 个静态页面。全库 pre-push
  ESLint 有 64 个范围外既有 warning、0 error；Stylelint 与 typecheck 退出 0。
- Opt-in `SEA_WEB_WIKI_QUALITY_ACCEPTANCE=1` 用一次性 PG17、真 RTW Go 服务、Next
  standalone
  BFF 和本地内容寻址对象执行 22 条断言，顶层退出 0。涵盖无管理员 401、非名单 403、管理员 200/幂等、单 Fact
  GET/List/编辑 head、CAS 409、无管理员 User cookie 拒绝与双 cookie
  Admin 成功、撤回 Source 正文不可读而旧判断仍在列表，以及原工作台的冻结/手动发布/回滚回归。停止后
  `pg_ctl status` 为 3。受保护本机报告
  `/var/folders/f_/l5hv3b1d6sx8zwr_cc8fkjkm0000gn/T/sea-web-knowledge-acceptance-na6sMy/result.json`
  SHA-256 `27a9287e9ff6c4b8f93b5488e651c2bc4fb2c02c44a8f7f61e7ec759fa6f1a9a`。
- Codex in-app
  browser 在同一隔离环境的双 cookie 工作台观察到：第一版 Wiki 是历史修订，当前编辑 head 是第三版，活动 Release 为已发布初版；同一 Fact 的旧
  `undetermined` 判断 revision 2 经页面 POST 改为 `missing/0` revision
  3，理由被清空而 Wiki/Release 指针不动。撤回 Source 的模块里，原正文不可读、证据按钮禁用，旧
  `missing/0`
  标签仍可见；公开书架只列已发布主模块，知识答案历史入口可达。临时浏览器标签已关闭，Go/Next/PG17 均停止。该浏览器轮的受保护报告
  `/var/folders/f_/l5hv3b1d6sx8zwr_cc8fkjkm0000gn/T/sea-web-knowledge-acceptance-QcYSnt/result.json`
  SHA-256 `41fd016a087b40db6c85ba2d539f6fdd568c35344a9e02294079dcb556825718`。

本轮浏览器没有真实 UserCenter 的 accepted-answer 内容、真实生产管理员资格、完整 FactSet/D07、真实三路检索质量、生产对象存储或部署验收。测试中的管理员 JWT、服务 token、PG 和端口均为临时隔离环境，不作为在线凭证或生产结论。

## 复现

```sh
node scripts/sync-knowledge-contract.cjs /path/to/fixed-rtw-checkout
node --test tests/knowledge-contracts.test.cjs tests/knowledge-quality-session.test.cjs tests/knowledge-quality-source.test.cjs
pnpm typecheck
pnpm build
SEA_WEB_WIKI_QUALITY_ACCEPTANCE=1 node scripts/knowledge-acceptance.cjs /path/to/fixed-rtw-checkout
```

如需浏览器手工核对，给最后一条命令加
`KNOWLEDGE_KEEP_RUNNING=1`，只打开脚本输出的 `/session/quality-dual`
本机地址；完成后向脚本发送 SIGINT，它会停止自己创建的 Go/Next/PG 进程。测试报告在脚本输出的随机临时目录，凭据不进 Git。
