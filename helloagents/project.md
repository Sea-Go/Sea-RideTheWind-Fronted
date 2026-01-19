# 项目技术约定

本文件记录仓库的技术栈与协作约定，作为团队一致性参考。

---

## 技术栈

- **前端框架:** Next.js (App Router)
- **语言:** TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **运行时:** Node.js 22.22.0
- **包管理:** pnpm 10.28.0 + corepack

---

## 开发约定

- **代码规范:** ESLint + Stylelint + Prettier（启用
  `prettier-plugin-tailwindcss`）
- **编辑器约定:** `.editorconfig` 统一缩进与换行；VS Code 开启 `formatOnSave`
  并启用 `source.fixAll.eslint` / `source.fixAll.stylelint`
- **提交规范:** Conventional Commits（详见 `doc/git规范.md`）
- **交互式提交:** Commitizen + cz-git
- **Hooks:** Husky + lint-staged

---

## 错误与日志

- **策略:** 运行时错误统一在应用层处理；记录可追踪日志（待业务接入后补充）

---

## 测试与流程

- **测试:** 当前阶段不启用
- **CI:** 当前阶段不启用（保留本地 lint/typecheck）

---

## 规范文档索引

- `doc/工程规范总览.md`
- `doc/代码规范-前端工程协作.md`
- `doc/代码提交与协作流程.md`
- `doc/质量与检查清单.md`
- `doc/目录与模块说明.md`
