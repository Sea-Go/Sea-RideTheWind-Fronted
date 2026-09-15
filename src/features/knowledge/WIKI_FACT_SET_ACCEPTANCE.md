# Wiki 事实目录工作台：产品与技术验收

状态：独立开发分支 `feat/wiki-fact-set-workbench-20260916`，最终 Web
`32ad232a10bf45a5be38cdf177e4f65263fb3b70`。RTW 合同固定为
`d10d1d3449dd72bc225061fd1e9bb4100810b8a1` 的 `api/knowledge.api`，DSL SHA-256
`933908f1209a1e22edb8f79b3e902ba1a12930180070ae404c00041827066f13`；运行仓内
`scripts/sync-knowledge-contract.cjs` 从 RTW goctl
1.9.2 的 TypeScript 和 OpenAPI 同步了产品类型与三条管理路由。生成差量仅为组件类型 +94 行、产品路由 +3 条、来源哈希更新；BFF 分类与客户端调用是独立手写代码，未代理 Worker 原 Event 接口。

## 产品行为与交接边界

工作台新增“事实目录”：管理员先选不可变 Wiki 修订，客户端按已接纳 AI
Compile 的**全部**固定来源，或人工 Wiki 自身与同页 base 祖先引用加 AI 祖先 Compile 的完整来源，读取原修订正文与 SHA-256 后形成**待 RTW 核准**的来源范围。正式撤回且只属于祖先的来源可排除；当前 Wiki 或 AI 编制引用已撤回来源时停止新声明。缺少旧来源元数据或原文不可取时也停止，不猜测一个可用子集。RTW 在
`POST /fact-sets` 再核完整资格与原字节归属。

维护者可增减最多 128 条事实、选择 `paragraph:N`、逐字取原文短引文、标出
`required`
与可选冲突组。预览显示原 UTF-8 引文字节范围和按 RTW 合同计算的候选 FactID；冻结后以 RTW 返回的 FactID、范围、SourceScope 和 Event/JCS 摘要为准。必须显式勾选“全部预期事实”并写声明理由；`facts_complete`
是**管理员的声明**，来源校验无法证明没有漏列事实。旧同范围目录采用
`base_fact_set_revision_id`
CAS，网络重试保留同一幂等键；409 保留草稿并要求重新读取当前 head。

目录当前 head 只能以 `source_scope_revision` 读取，旧版必须给明确
`fact_set_revision_id`
按 ID 读取；页面提供上一次目录修订链。历史原有事实片段可看，撤回来源正文 GET 仍是 410，没有从历史目录调用原文 GET 绕过撤回。每次目录冻结不修改 Wiki 编辑 head、候选或活动 Release；逐事实人审仍在相邻“事实核验”中单独操作，也不因此产生 D07 页面质量结果。`actor_id`
只显示“管理员账号标识”，是 RTW Admin JWT `userId`
与允许名单的字面值，**不是**已验证的 UserCenter
UID。当前没有租户字段，也没有建立跨系统同人关系。

三条 FactSet 路由由浏览器 `knowledgeAdminRequest` 用 Admin JWT 调用；Next
BFF 在只有双 Cookie、没有显式 Authorization 时同样优先 Admin Cookie。User
Cookie 单独访问 RTW 管理端得到 401，显式非管理员 Bearer 得 403。Worker 私有原 Event 不进入生成的产品路由白名单。

## 验收证据

- 最终 Web `32ad232` 的 Node 合同/组件/鉴权测试 **76/76 PASS**，日志 SHA-256
  `ab50e4d3ae5e1dff6afc473ffb2716d3a0190b94068599c78dbe608ae3d2025f`。其中 5 条 FactSet 聚焦用例验证 AI 全部 Compile 来源、人工同页祖先与正式撤回、CRLF/UTF-8 原 byte
  span 与 FactID、Admin 双 Cookie 路由及 Worker 禁止。全项目
  `tsc --noEmit`、scoped
  ESLint 零警告、Stylelint、Prettier 与 whitespace 通过；最终 Next16
  standalone 构建 63 个静态页面，BUILD_ID
  `O66XZAcLJWnqBhR3CiFDY`，构建日志 SHA-256
  `69b379672235b5167908463fa11dc5f1cdf72ad8a93df0819578496adc0a1c6e`。
- 首轮本地 PG17/RTW/Next 真 HTTP **RED**：新增测试误将 `POST /sources`
  返回的修订元数据 `a.content` 当原文，`Buffer.from(undefined)`
  于断言处失败；之前已执行的管理端调用不计全轮成功。原日志 SHA-256
  `8426f74c9ae8a2dbda6c7a314663c38405acf00b59cbe8e8f2d973b05b4cabf3`，报告 SHA-256
  `2bace37b6308eeec986a45d99ed832aff5b7b7f8b45b5e5fded9ccf495e5ea3b`；临时 PG 已停，`pg_ctl status=3`。修复后测试明确 GET 固定 Source
  Revision 原正文并核 SHA，保留原红记录。
- 修后临时 PG17/RTW `d10d1d3`/Next **27 项 HTTP 断言全 PASS**；用的是 Web
  `03afb7e` 构建
  `klcsQkq9_tUz3xMZ8kxqo`。管理员目录无身份 401、非名单 403、管理 POST
  200、双 Cookie POST 重放/单 User
  Cookie 历史 GET401、scope 当前 head 与历史按 ID、同范围第二次目录 CAS/旧 Wiki 历史固定及 stale
  409 均通过。真实目录返回 required FactID、原文短引文 byte
  span；冻结前后 Wiki 编辑 head 和活动 Release 独立。正式撤回来源后原文 GET410，旧目录修订按 ID 仍可读。报告 SHA-256
  `6214a891267486bbbbe2b5ef2874e89695d53ffc8d7920112552802391199`、顶层日志
  `4d9bf38d443a84ff38b7e62df0d593b85b4e717ba3f898f324c10594237936ea`、Go binary
  `14c831fbdfc096f7d5991c325eea1934b54da30a9dadd166baf030ac85161aaa`、PG 停机
  `setup.log`
  `2522ed2a7c759078aa5f06414e901eaaf1e52421d457c3e85ce96c2ea6c13b90`，`pg_ctl status=3`。只存任务私有目录
  `/var/folders/f_/l5hv3b1d6sx8zwr_cc8fkjkm0000gn/T/sea-web-knowledge-acceptance-QkJzhW`，随机测试凭据不入库。
- 实际 Codex in-app browser 用本地双 Cookie 会话：选择 Wiki
  v2 后读取该来源范围当前目录；点击“整段原文”、填理由与完整声明并以页面 POST 冻结目录第三修订。页面候选 FactID
  `fact_e0cc22375d240d0be33dff74b8bce6b3922f24637d7a3098d79c8ad7cc63ef56`/原 byte
  `0:21` 与 RTW 返回逐字一致；点击“上一次”明确读到第二修订 FactID
  `fact_82172e994c9bfc4803ce8c4426fb6bf6cd491ba7bef6e1981d1b560adcaf5a0c`、原 byte
  `23:44`。撤回模块选择 Wiki 时停止新范围预览，但输入已知目录修订 ID 可以查看原目录事实。720px 视口下事实表单与旧质量双栏均变为单栏，`documentScrollWidth=708 <= viewportWidth=720`；视口已重置、验收标签已关闭。该浏览器第三修订是独立临时 PG 中的测试记录，未改生产数据。

最后 `32ad232`
仅改善“当前来源已撤回/旧来源元数据缺失”时的预览错误文案与早拒，已通过最终 Node/TypeScript/Next 构建；**没有再次运行 PG/RTW
HTTP**，上述 27 项真接口证据固定于前一 Web 构建
`03afb7e`。本轮没有外部真人证明事实全集、没有 UserCenter 同人标识校验、没有 D07 页面质量评测、没有旧生产数据库迁移或生产发布。

复现：`node tests/knowledge-fact-set.test.cjs`；完整接口门禁须先构建 Next
standalone，再仅在任务专属临时 PG 环境执行
`SEA_WEB_WIKI_FACT_SET_ACCEPTANCE=1 node scripts/knowledge-acceptance.cjs <RTW 固定开发 checkout>`，RTW 测试配置显式开启
`WikiFactSets`，正常服务仍默认关闭。

## Web内容开发集成与旧撤回元数据补查

独立FactSet工作台远端`feat/wiki-fact-set-workbench-20260916@05c40c785545e2fa3ad1f7a99399656b718fd56f`洁。根按合同/原字节/工作台/PG门禁/原文fixture纠正/撤回预览文案/交接七笔`e4a8b16/4454897/fa6c57d/585b928/03afb7e/32ad232/05c40c7`精确cherry到既有Web内容开发头`0caec9c/a7ebf67/e1d70ef/d35da64/0032641/e17d59b/e65cd9e`。只读同行未见P0–P2；P3指出旧人工Wiki祖先来源若已正式撤回但被修订列表分页藏在更早页，首屏`knownRevisions`没有metadata、原文GET410就需维护者手动加载更早修订；RTW真实范围允许合法排除该**祖先**。另开独立`feat/wiki-fact-set-withdrawn-metadata-20260916@cacebaf273b8a20a80839c1c6496f2d4306e7d83`从开发`e65cd9e`两笔`492d3d7/cacebaf`，根仅cherry到开发`0f0e30b/260c2e0`：只在旧ID不在已知页且固定原文不可取时，用管理员既有`revisions`分页按需找 exact
Source
ID 的正式withdrawn元数据；至多32页，每页≤20，重复cursor/行、错module/kind/未撤回或缺页均拒。当前Wiki引用或AI固定Compile中的withdrawn仍拒，常规预览不扫历史；RTW
POST继续为最终权威资格。

从最终开发头`260c2e0`另跑**122项**Node全测试PASS、TS/局部ESLint零警告/Stylelint/Prettier与diff
check0，testSHA=`07f3587a54f70dcd47f284aa615f06df044982be809bde2c5c74ec23b7cc0e7d`、typecheck日志SHA=`074e1f469626253deb94d0b06b8fa025ff463ddf5a82b419dd1be4e7f4f5b6a1`；Next16
standalone构建63页、BUILD_ID=`TOCJIX1hk2_ExXTPf9-Wf`、buildSHA=`b57df47f268bb6d678c1b0fff8c398962a042afe3d6e14906ea86ec741de47ef`，固定日志`sea-web-factset-integrated.ZAaJ92`。有界跨页withdrawn/未知元数据拒错为纯Node夹具和独立分支TS/lint签收；**没有**在Web开发`260c2e0`重跑PG17/RTW真HTTP或IAB
720px，前述27项真实管理BFF及实际浏览器POST仍明确固定于独立Web
`03afb7e`/`32ad232`历史构建与RTW `d10d1d3`。独立测试PG
stop/status3、原红/绿报告和原Release不变证据继续保留；开发新HEAD产品联验、真人目录质量、自动发布及生产部署另签。
