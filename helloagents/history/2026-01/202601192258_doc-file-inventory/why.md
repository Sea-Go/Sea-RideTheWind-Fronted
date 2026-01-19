# 变更提案: 文档清单与测试/CI清理

## 需求背景

当前 doc/ 目录缺少对项目内各文件用途的集中说明，影响新成员理解与维护。项目当前阶段暂不需要测试与 CI，需要移除相关配置与脚手架以降低维护成本。

## 变更内容

1. 在 doc/ 下新增文件用途清单文档，包含全量文件用途说明。
2. 移除测试与 CI 相关配置、脚本、依赖与文件。
3. 在知识库中同步 docs 与 quality 模块说明。

## 影响范围

- **模块:** docs, quality, tooling
- **文件:** doc/文件用途清单.md, .gitignore, .stylelintignore,
  .github/workflows/ci.yml, vitest.config.ts, playwright.config.ts, tests/,
  src/**tests**/, src/test/, package.json, pnpm-lock.yaml, .husky/pre-push,
  helloagents/project.md, helloagents/wiki/arch.md,
  helloagents/wiki/overview.md, helloagents/wiki/modules/docs.md,
  helloagents/wiki/modules/quality.md, helloagents/CHANGELOG.md
- **API:** 无
- **数据:** 无

## 核心场景

### 需求: 文件用途清单

**模块:** docs为所有现有文件提供用途说明，形成可追溯的文档索引。

#### 场景: 文档补充

现有工程已具备文件结构，需要一份集中描述文档。

- 预期结果: doc/ 新文档包含全部文件用途
- 预期结果: 知识库记录该文档职责

### 需求: 移除测试与CI

**模块:** quality 暂时关闭测试体系与 CI 流程，减少项目维护负担。

#### 场景: 轻量化工程配置

现阶段不需要自动化测试与持续集成。

- 预期结果: 测试与 CI 相关文件与配置被移除
- 预期结果: 开发流程不再依赖测试/CI 脚本
