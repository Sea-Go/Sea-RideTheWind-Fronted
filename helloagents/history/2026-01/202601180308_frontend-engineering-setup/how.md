# 技术设计: 前端工程化基础架子

## 技术方案

### 核心技术

- Next.js(App Router) + TypeScript + `src/`
- Tailwind CSS + shadcn/ui
- ESLint / Prettier / Stylelint + `prettier-plugin-tailwindcss`
- commitlint + Husky + lint-staged + Commitizen + cz-git
- Vitest + React Testing Library + Playwright
- GitHub Actions
- Node v22.22.0 + pnpm + corepack

### 实现要点

- 使用 `create-next-app` 生成 App Router + TypeScript + `src/` 的基础结构
- 使用 shadcn/ui 官方 CLI 初始化默认配置与 `components.json`
- ESLint 基于 Next.js/TypeScript 默认规则，补充团队约束（如禁用未使用变量、限制 any）
- Prettier 统一格式化，并启用 `prettier-plugin-tailwindcss` 自动排序类名
- Stylelint 仅覆盖 CSS/Tailwind 相关文件，避免与 ESLint/Prettier 冲突
- commitlint 采用完整 Conventional Commits 类型集，并按 `doc/git规范.md`
  扩展规则
- Commitizen + cz-git 提供交互式提交；Husky 绑定 pre-commit / pre-push
- lint-staged 仅处理变更文件，减小本地执行成本
- `packageManager` + `engines` + `.nvmrc` + `.node-version` +
  corepack 统一 Node/pnpm
- 测试体系采用 Vitest(单测) + RTL(组件测试) + Playwright(E2E)
- CI 采用 GitHub Actions，最小流水线覆盖 lint/typecheck/test/build

## 架构设计

本次不引入新的运行时架构，仅建立工程化工具链与流程门禁。

## 架构决策 ADR

### ADR-001: 统一 pnpm + corepack + Node v22.22.0

**上下文:** 多人协作环境差异导致依赖漂移与不可复现问题。  
**决策:** 在 `packageManager`、`engines`、`.nvmrc`、`.node-version`
中统一版本，并启用 corepack。  
**理由:** 标准化工具链，降低“本地可运行但他人失败”的概率。  
**替代方案:** 仅靠文档约束 → 拒绝原因: 缺乏强制性与可验证性。  
**影响:** 所有贡献者需安装对应 Node 版本并使用 pnpm。

### ADR-002: 采用 commitlint + cz-git + Husky 形成提交门禁

**上下文:** 提交信息不统一导致历史不可追溯。  
**决策:** commitlint 校验 + cz-git 交互提交 + Husky hook 约束。  
**理由:** 兼顾规范与易用性，降低错误提交。  
**替代方案:** 仅靠人工 review → 拒绝原因: 成本高且无法预防性拦截。  
**影响:** 新增依赖与 git hooks，对贡献者首次安装有学习成本。

## API设计

不涉及。

## 数据模型

不涉及。

## 安全与性能

- **安全:** 禁止提交密钥与凭证；CI 中使用最小权限 token
- **性能:** CI 使用缓存（pnpm store）；pre-commit 仅处理变更文件

## 测试与部署

- **测试:** `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm e2e`
- **部署:** 先构建 `pnpm build`，CI 与本地保持一致
