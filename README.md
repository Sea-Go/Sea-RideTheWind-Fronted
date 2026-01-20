# 项目说明

- 关联后端：[Sea-TryGo](https://github.com/Sea-Go/Sea-TryGo)
- 框架：Next.js（App Router）
- 语言：TypeScript
- UI：Tailwind CSS + shadcn/ui
- 运行时：Node.js 22.22.0
- 包管理：pnpm 10.28.0 + corepack

## 快速开始

- 开发：pnpm dev
- 构建：pnpm build
- 生产启动：pnpm start

## 质量与格式化

- 统一校验：pnpm lint ---- ESLint：pnpm lint:eslint Stylelint：pnpm lint:style
- 类型检查：pnpm typecheck
- 格式检查：pnpm format:check

## 提交代码

- 交互式提交：pnpm cz
- 提交流程：doc/代码提交与协作流程.md
- 提交规范：doc/git规范.md

## 目录速览

- src/app：页面与布局
- src/components：组件
- src/lib：工具与通用逻辑
