# img → next/image 迁移验收（2026-10-06）

清除全部 19 处存量 ESLint 警告，恢复 CI 严格 lint 门（`pnpm lint:ci`，`--max-warnings=0`）。

实际构成：**17 处 `@next/next/no-img-element` + 2 处 `react-hooks/exhaustive-deps`**（后者同样会阻断 `lint:ci`，一并清除）。

## 迁移原则

- **动态/远程 URL**（封面预览，可为远程地址、`blob:` 本地预览、`data:` URI）：`<Image unoptimized …>`。`unoptimized` 直接透传原始 src：一是避免为任意用户上传域名扩张 `next.config.ts` 的 `remotePatterns`，二是 Next 16 对 `data:`/`blob:` 本就自动按 unoptimized 处理，行为一致。
- **本地 `public/sea/*.svg` 装饰图**：`<Image unoptimized … width height>`（数字 props）。保持 `unoptimized` 是因为 next.config 未开启 `dangerouslyAllowSVG`，SVG 走 `/_next/image` 优化器会 400；SVG 亦无优化收益。未改动 next.config 的 images 配置（尊重现状）。
- **保持视觉不变**：所有布局类名、`width`/`height` 语义、`loading="lazy"`、`onError` 回调原样保留；尺寸继续由既有 CSS（`.sea-app img`、`.sea-hero-art > img` 等后代选择器）接管，next/image 渲染的仍是 `<img>`，选择器全部继续生效。首页 hero 原 `fetchPriority="high"` 改为等价的 `priority` prop。
- **hook 警告**：`loadConversations` 参数化（体内不再读 `selectedConversationId`，改由调用点显式传 `nextSelectedConversationId`）+ `useCallback`，两个 effect 补依赖；函数引用恒等，选中行为与请求时机不变。
- **行内豁免：0 处**（无 dangerouslySetInnerHTML 等不可迁移场景）。

## 迁移清单（19 处）

| # | 文件 | 位置 | 组件/场景 | 迁移方式 |
|---|------|------|-----------|----------|
| 1 | `src/app/post/page.tsx` | :415 | 发布页封面预览 | `Image unoptimized`（动态 URL，`width/height` + 原 `h-56 w-full` 类与 `onError`） |
| 2 | `src/app/post/edit/[id]/page.tsx` | :353 | 编辑页封面预览 | 同上 |
| 3 | `src/features/knowledge/PublishedKnowledge.tsx` | :73 | PublishedModule 模块 hero | `Image unoptimized`（本地 SVG 420×290） |
| 4 | `src/features/sea/components/primitives.tsx` | :125 | StoryRow 故事插画 | `Image unoptimized`（动态 slug SVG，保留 `loading="lazy"`） |
| 5 | `src/features/sea/pages/CommunityExtras.tsx` | :203 | DemoArticle 文章头图 | `Image unoptimized`（动态 slug SVG） |
| 6 | `src/features/sea/pages/CommunityExtras.tsx` | :292 | DemoArticle 侧栏书籍卡 | `Image unoptimized`（本地 SVG） |
| 7 | `src/features/sea/pages/CommunityExtras.tsx` | :392 | CompanionPage hero | `Image unoptimized`（本地 SVG） |
| 8 | `src/features/sea/pages/CommunityPage.tsx` | :74 | 社区页侧栏插画 | `Image unoptimized`（本地 SVG） |
| 9 | `src/features/sea/pages/HomePage.tsx` | :40 | 首页 hero（LCP） | `Image unoptimized` + `priority`（等价原 `fetchPriority="high"`） |
| 10 | `src/features/sea/pages/HomePage.tsx` | :145 | 侧栏知识书架卡 | `Image unoptimized`（保留 lazy） |
| 11 | `src/features/sea/pages/HomePage.tsx` | :167 | WhaleHall 伴随卡 | `Image unoptimized`（本地 SVG） |
| 12 | `src/features/sea/pages/HomePage.tsx` | :190 | 书架预览模块封面 | `Image unoptimized`（动态 slug，保留 lazy） |
| 13 | `src/features/sea/pages/KnowledgePages.tsx` | :72 | KnowledgeShelf 标题插画 | `Image unoptimized`（本地 SVG，保留 `sea-heading-art` 类） |
| 14 | `src/features/sea/pages/KnowledgePages.tsx` | :102 | 书架模块封面 | `Image unoptimized`（动态白名单 slug） |
| 15 | `src/features/sea/pages/KnowledgePages.tsx` | :209 | DemoModulePage 模块 hero | `Image unoptimized`（动态 slug） |
| 16 | `src/features/sea/pages/KnowledgePages.tsx` | :390 | DemoKnowledgeReader 文章头图 | `Image unoptimized`（本地 SVG） |
| 17 | `src/features/sea/pages/LearnPage.tsx` | :329 | 学习页历史侧栏鲸鱼 | `Image unoptimized`（本地 SVG） |
| 18 | `src/app/admin/messages/page.tsx` | :128 | exhaustive-deps | `loadConversations` 参数化 + `useCallback`，effect 补依赖 |
| 19 | `src/app/admin/messages/page.tsx` | :158 | exhaustive-deps | 同上（`loadDetail` 内调用纳入依赖） |

**计数**：`import` 静态导入 0 处（登录页 jpg 已在前置分支迁移完毕）；`unoptimized` 17 处；行内豁免 0 处。

## 配套改动

- `tests/sea-contracts.test.cjs`：LearnPage 契约测试的依赖白名单补 `next/image` stub（`{ default: "img" }`），随迁移同步契约。
- `.github/workflows/ci.yml`：Lint 步骤由 `pnpm lint` 恢复为 `pnpm lint:ci`（技术债已清）。

## 验证命令尾行

```console
$ pnpm exec eslint .
（无输出，0 errors 0 warnings）

$ pnpm exec tsc --noEmit && echo TSC-OK
TSC-OK

$ pnpm lint:ci; echo "LINTCI-EXIT=$?"
LINTCI-EXIT=0

$ pnpm build 2>&1 | tail -3
prepared standalone asset: .next/static
prepared standalone asset: public

$ for f in tests/*.test.cjs; do node "$f" >/dev/null 2>&1 && echo "PASS $f" || echo "FAIL $f"; done
PASS tests/knowledge-answer-history.test.cjs
PASS tests/knowledge-contracts.test.cjs
PASS tests/knowledge-fact-set.test.cjs
PASS tests/knowledge-product-search.test.cjs
PASS tests/knowledge-quality-session.test.cjs
PASS tests/knowledge-quality-source.test.cjs
PASS tests/sea-contracts.test.cjs
```

注：仓库无 `pnpm test` 脚本，`tests/*.cjs` 为 node:test 契约测试，逐文件直跑（如上）。

## 遗留

- 无阻断遗留。可选后续：为 `public/sea/*.svg` 开启 `dangerouslyAllowSVG` 并去掉这批 `unoptimized`——收益近零（SVG 无优化空间），不建议。
