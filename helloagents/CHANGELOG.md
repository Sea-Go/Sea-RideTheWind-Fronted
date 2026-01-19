# Changelog

本文件记录项目所有重要变更。格式基于
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/), 版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- 新增 doc/文件用途清单.md，用于记录仓库文件用途

### 变更

- 更新 docs/quality 模块文档以反映测试与 CI 暂停
- 调整 .husky/pre-push 钩子，移除测试命令
- 同步更新知识库架构与技术约定说明

### 移除

- 移除 GitHub Actions CI 工作流
- 移除 Vitest/Playwright 测试配置与相关脚本/依赖
- 移除 tests/、src/**tests**/、src/test/ 目录

## [0.1.0] - 2026-01-18

### 新增

- 初始化 Next.js(App Router) + TypeScript + Tailwind CSS + shadcn/ui 项目结构
- 引入 ESLint/Prettier/Stylelint/commitlint/Husky/Commitizen/cz-git/lint-staged
- 引入 Vitest/RTL/Playwright 与 GitHub Actions CI
- 统一 Node v22.22.0 与 pnpm 10.28.0 版本约束
