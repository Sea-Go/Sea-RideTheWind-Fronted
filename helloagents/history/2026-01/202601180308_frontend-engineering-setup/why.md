# 变更提案: 前端工程化基础架子

## 需求背景

当前项目为多人协作的开源项目，规模较大且需要长期维护。为了提升一致性、效率与可交付性，需要建立完整的前端工程化基础架子，并将规范固化到工具链与流程中。

## 变更内容

1. 使用 `create-next-app` 初始化 Next.js(App Router) + TypeScript + `src/`
   的基础项目结构
2. 集成 Tailwind CSS 与 shadcn/ui（默认配置）
3. 引入 ESLint、Prettier、Stylelint，并启用 `prettier-plugin-tailwindcss`
4. 引入 commitlint + Husky + lint-staged + Commitizen + cz-git，落地提交规范
5. 建立测试与 CI 基础：Vitest + React Testing Library + Playwright + GitHub
   Actions
6. 统一 Node v22.22.0 与 pnpm（`packageManager` + `engines` + `.nvmrc` +
   `.node-version` + corepack）

## 影响范围

- **模块:** tooling / quality / docs
- **文件:** `package.json`, `src/*`, `next.config.*`, `tsconfig.json`,
  `eslint.config.mjs`, `.prettierrc.*`, `stylelint.config.*`,
  `commitlint.config.*`, `.husky/*`, `.lintstagedrc.*`, `.nvmrc`,
  `.node-version`, `.github/workflows/*`, `playwright.config.ts`,
  `vitest.config.ts`
- **API:** 不涉及
- **数据:** 不涉及

## 核心场景

### 需求: 工程化基础

**模块:**
tooling建立统一的工程化工具链与提交规范，保证多人协作的一致性与质量门禁。

#### 场景: 多人协作与质量门禁

条件：多人提交、频繁合并。

- 提交信息可追溯，lint/format/stylelint 在本地即可发现问题
- PR 合入前可自动完成基础质量检查

#### 场景: 一致运行环境

条件：不同开发者环境差异大。

- 统一 Node/pnpm 版本，避免依赖漂移
- corepack 与版本约束防止工具链不一致

### 需求: 测试与持续集成

**模块:** quality 建立基础测试与 CI 流程，确保主干稳定可交付。

#### 场景: PR合入前验证

条件：Pull Request 合入主干前。

- 自动执行 lint/typecheck/test/build
- 关键链路具备最小的 e2e 覆盖

## 风险评估

- **风险:** 初次引入工具链导致配置复杂、执行时间增加
- **缓解:** 分层执行（pre-commit/CI）、使用缓存、规则渐进收紧
