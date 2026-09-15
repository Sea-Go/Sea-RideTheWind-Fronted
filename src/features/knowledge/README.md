# 知识工作台产品客户端

背景 BG-2026-09-13-r2；任务 WS03-B 和知识域 WS03-A；消费 H02，H03/H06 由 RTW 映射到产品 API。当前产品契约从 RTW 固定质量源
`d10d1d3` 的 goctl 1.9.2 输出同步，不代理 internal
worker。此前阶段交付的缺失读面现已接通。

## 产品能力

- 已接纳知识问答历史从知识书架进入，按已知逻辑会话 ID 查看 RTW 用户态产品记录、固定答案及当前引用可用性；具体合同与局部验收见
  [ANSWER_HISTORY_ACCEPTANCE.md](ANSWER_HISTORY_ACCEPTANCE.md)。当前学习对话尚未交付对应的权威知识会话 ID。
- `/workbench/modules`
  读取管理员模块列表、建立草稿；单模块工作台读取草稿详情。`/knowledge`
  及模块目录只读取有效已发布版本。
- 资料导入支持 UTF-8
  Markdown/文本。原文、Wiki 分别形成不可变修订；管理员点选历史修订后单独读取正文再编辑，来源绑定具体 revision 和
  `paragraph:N`。加载正文期间锁定编辑表单；失败保留原输入，不以空文本替代正文。
- Wiki“事实核验”对一个固定原文事实与一个不可变 Wiki 修订记录人工 0–3/无法判定，按原字节核证据、旧判断 CAS 复核，并独立显示 Wiki 编辑 head 与活动 Release。撤回来源正文不可重读时保留既有判断列表；不从单 Fact 推断页面质量或自动发布。局部验收与身份边界见
  [WIKI_FACT_REVIEW_ACCEPTANCE.md](WIKI_FACT_REVIEW_ACCEPTANCE.md)。
- Wiki“事实目录”按已接纳编制全部来源或人工同页来源链给出待 RTW 核准的预览；管理员显式声明预期事实全集、逐条原字节片段和 required 标记，CAS 冻结同范围目录，按指定目录修订 ID 查看旧历史。正式撤回来源停止新证明但旧目录片段可查；这不是客观完整性证明、UserCenter UID、D07 或发布指针。技术与本地 PG/浏览器验收见 [WIKI_FACT_SET_ACCEPTANCE.md](WIKI_FACT_SET_ACCEPTANCE.md)。
- 修订比较左右独立读取固定正文，可比较历史与新版本。后续发布/回滚不会静默替换选定修订。
- 修订、候选 release、build、compile 均沿服务端 `next_cursor`
  分页读取。人工刷新返回最新一页；后续页保持提供方游标的成员上界。大正文仅按选中修订读取，不批量加载整本内容。
- 构建/编制状态及历史从服务端恢复，刷新页面仍可取消待执行任务、选择历史 READY 构建发布或回滚。发布携带 release/build/expected_pointer_revision/reason/幂等键；409保留原版本和表单输入。
- 可见的编制/发布标签每5秒读取其中待执行任务的详情，隐藏浏览器页停止轮询；同一轮不重叠，终态后重新读取模块与修订。服务故障显示上次状态和刷新错误，不伪造成功。NOT_BUILT、FAILED、CANCELLED、SUPERSEDED 与未知状态分别显示；未接领任务显示等待 worker。
- 公开阅读固定 release +
  revision。历史版本须曾经真实发布；引用沿相同 release 回到具体原文和段落。已选 revision 缺少 release 时拒绝套用当前版本。未发布/非成员404、撤回410、正文读取失败均显示不可读，不回退其他正文。
- 公开书架、模块和阅读页可直接访问；工作台沿用原有登录行为，实际管理权限由 RTW 校验。既有社区/账号实现与独立设计 demo 保留。

## 契约与配置

`api.ts` 只包含产品调用。权威类型复制自 RTW `api/knowledge.api` 的 goctl
TypeScript；产品路由/方法表由 Swagger 提取，剔除 internal worker。源 SHA 与 DSL
hash 见 `generated/source.json`。脚本归一化生成文本，不手改生成物。

```sh
node scripts/sync-knowledge-contract.cjs /path/to/rtw-checkout
```

`SEA_PRODUCT_API_SERVER_URL` 指向 RTW 服务根地址，不带
`/v1`。BFF 透传登录身份、原 HTTP 状态与 envelope，并贯通取消信号；未配置503，未知产品路径/方法404。三路配置由搜索提供方给出，界面不自动填入虚构模型空间；READY 仍需人工发布。

## 2026-09-14 验收

- 58项定向 Node 契约/组件测试通过，覆盖生成产品路径与方法、幂等命令、错误透传、状态分辨、正文读取失败保留输入、重载历史回滚参数、固定阅读链接/定位、公开阅读与工作台路由，及既有学习流回归。
- 类型检查、Node22.22.0 下 Next16.1.3 生产构建及 standalone 资源准备通过（62个静态页面）；scoped
  ESLint无错误，保留本地SVG图片优化提示；新 CSS Stylelint、git diff
  whitespace检查通过。
- 真实 Next
  BFF→go-zero→独立 PostgreSQL/本地内容寻址对象通过16组断言：书A初版、修改Wiki、加入书B、重复发布/409/回滚；管理员详情、分页元数据与非空正文/hash、刷新后READY/取消/替代/待执行历史；固定上界分页不吸收后建候选；公开旧版及404/410语义。
- 实际 Chrome 通过 CUA 原生操作验收：读取已有原文/Wiki后追加第四修订，比较第二/第四版正文；刷新后从历史构建发布v3，再刷新回滚v1，指针4→5→6；取消历史编制任务；回滚后第二版固定正文与原文段落仍可读；未发布/撤回页面均显示不可读。

记录：[读链验收](../../../acceptance/knowledge-read-20260914.json)；先前写链阶段记录保留在[阶段验收](../../../acceptance/knowledge-20260914.json)。浏览器扩展会话超时后使用 CUA 原生 Chrome，仅操作新建的本地验收标签页。

补充生成契约验收：`8ddc034`
不改变路径、wire 或业务行为；重新生成后，三个分页 Params 可省略 limit，所有列表末页可省略 next_cursor 的 TypeScript 消费编译通过。58项契约/组件测试与全项目类型检查通过；未重复不变业务的浏览器验收。

## 仍未验收的边界

H06索引使用明确标记的结构 fixture，只证明产品契约、状态与发布交接，不证明真实 Dense/Sparse/Multi-vector 编码、独立检索与质量。真实 AI 编制、搜索版本查询、生产 S3、统一身份中心角色映射及部署仍由对应任务继续完成；本次没有生产部署。

## 复现

```sh
node --test tests/knowledge-contracts.test.cjs tests/sea-contracts.test.cjs
pnpm typecheck
pnpm build
KNOWLEDGE_PG_BIN=/path/to/postgresql/bin node scripts/knowledge-acceptance.cjs /path/to/rtw-checkout
```

验收脚本只创建随机端口的独立本地 PostgreSQL、Go/Next进程和对象目录。`KNOWLEDGE_KEEP_RUNNING=1`
可留给人工 UI 验收；结束发送 SIGINT/SIGTERM 会停止该脚本创建的服务。日志和随机测试凭据只在临时目录，不提交远端。

聚合契约补充：发布配置可明确指定sum_maxsim或mean_maxsim，页面按原值提交，不在两者之间换算。maxsim仅保留早期结构fixture的兼容输入，真实多向量模型需使用固定数学聚合与对应表示契约；BGE-M3为mean_maxsim。
