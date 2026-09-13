# Sea / RideTheWind 前端设计整合

本地按文件整合网页设计交付，保留 Next 16.1.3、React 19.2.3、Tailwind
4 和原有依赖锁文件。原 README 仍适用于业务服务配置。

## 本地运行

使用项目声明的 Node 22.22.0、pnpm 10.28.0：

```bash
pnpm install --frozen-lockfile
SEA_ENABLE_DEMO=1 pnpm dev --webpack --hostname 127.0.0.1 --port 3123
```

打开 `http://127.0.0.1:3123/?demo=1&theme=mountain`。主题可选
`mountain`、`planetarium`、`summer`。演示必须同时开启服务端环境变量和
`?demo=1`，页面会持续标明示例内容；接口失败不会回退到示例。

构建与独立启动：

```bash
pnpm build
SEA_ENABLE_DEMO=1 HOSTNAME=127.0.0.1 PORT=3123 node .next/standalone/server.js
```

正式使用关闭演示开关，沿用原服务变量和登录会话。新知识、搜索、全站学习适配层使用
`SEA_PRODUCT_API_SERVER_URL`，未配置时返回 503。`.env.sea.example`
默认关闭演示，不包含实际服务地址或凭据。

## 页面与业务

- `/`、`/community`：新探索首页与社区，从既有文章 API 读取正式内容。
- `/article/[id]`：真实文章完整保留原实现，包括评论、回复、赞同和收藏；演示 ID 单独使用设计阅读页。
- `/editor`：新的简单编辑页接既有
  `createArticle`，成功表示提交到原审核流程；完整上传编辑器继续使用
  `/post`、`/post/edit/[id]`。
- `/knowledge`：知识书架。`/knowledge/[id]` 按 ID 读取模块，不依赖书架第一页。
- `/knowledge/[id]/workbench`：读取和手动发布绑定同一模块。旧入口
  `/knowledge/workbench?module_id=...`
  也支持显式模块；正式模式未选模块不会发送默认山地请求。
- `/knowledge/[id]/read`、`/sources`：固定修订正文尚待服务接入，正式模式明确显示待接入。
- `/learn`、`/search`、`/interests`、`/companion`：新学习、搜索、兴趣与桌宠关系页。原
  `/dashboard/search`、`/dashboard/recommend`、兴趣问卷继续可达。
- 账号菜单保留个人空间、文章管理、收藏、关注、消息、发布、旅行和管理员入口，以及原会话退出操作。旅行继续遵守
  `hideFooter` 布局约定。

主题只控制本地视觉和 URL，不进入数据请求依赖。夏夜画布为纯黑，使用原创银河和萤河 SVG。旧业务组件使用新主题变量，并保留其原有按钮样式。

## 整合边界

仅导入新产品源码、路由与原创 SVG，未导入原交付的生成 HTML、截图、导出脚本、日志、临时类型文件，也未采用远端为修复脱敏所做的密码参数改动。原始交付保持只读。本地用户已有十处改动、完整原文章实现、package/lock/auth 均与主工作目录逐字节核验。

新知识元数据与发布汇总、固定修订正文、真实来源上传/编制/diff、知识搜索、全站学习历史/SSE 与推荐 slate 仍是待核对的产品契约，不能据此声称后端已实现。生产模式没有填充演示知识或演示用户兴趣。学习停止会中断读取并尝试取消已知 answer_id；恢复只 GET 原回答，不自动重新调用模型。推荐实际曝光与负反馈仍需后端幂等、版本和归因协议完成才能作为完整闭环验收。

## 本地验证（2026-09-13）

```bash
pnpm typecheck
pnpm build
node --test tests/sea-contracts.test.cjs
pnpm exec stylelint src/features/sea/sea.css
```

Node
22.22.0 上完整生产构建通过，包含 61 个静态页面，standalone 静态资源准备成功；全项目类型检查通过。14 项定向测试执行实际 TypeScript 模块，覆盖原文章/题名联想响应、指定模块发布参数、跨 UTF-8/CRLF 边界的 SSE、首事件不等待 EOF、空闲流取消、BFF 不缓冲及未配置产品 API 的 503/404。学习页面回归直接执行实际组件处理器与流读取，确认 completed/failed 之后的网络错误、非法尾部事件和停止仅清理传输、不覆盖业务终态，也不会再次提交取消；终态之前的错误仍正常标记失败。

本地 Chrome 已验证三主题切换及 390×844 手机端的新建对话、恢复历史、关闭与 Escape 焦点返回，并保存真实浏览器全页图。手机侧栏使用同一组处理器与状态；展开类名采用两个完整字符串，避免格式化器删掉插值前导空格。最终验证构建 ID 为 `mNyhX6CNQLZNhBRS8QbBi`。这些结果证明本地页面与交互，不代表新知识后端或真实模型服务已上线。

新增与修改的设计代码 scoped ESLint 为 0 error、14
warning，均为轻量本地 SVG 使用原生 `img` 的 Next 优化建议；新 CSS
Stylelint 通过。未把 scoped 检查表述成全仓 lint 通过。

本地生产服务的 21 项 HTTP 检查通过：三主题及产品演示路由、真实模块工作台标识、关闭 query 后的认证跳转、管理员路由不受 demo 放行、缺服务 503、未知路径 404。浏览器视觉与交互由独立本地 QA 记录；这些协议检查不替代真实登录、文章写入、知识发布、实际模型流与线上业务验收。
