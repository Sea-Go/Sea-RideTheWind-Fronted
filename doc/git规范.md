# Git 规范

本规范与当前项目配置保持一致：

- Commitlint：`commitlint.config.cjs`
- 交互式提交：`cz-git.config.cjs`

## 提交信息格式

标准格式：

```
<type>(<scope>): <subject>
```

示例：

```
feat(app): 新增首页模块
fix(ui): 修复按钮样式问题
```

## Type 规范（与配置一致）

- `feat`：新增功能
- `fix`：修复缺陷
- `docs`：仅文档变更
- `style`：代码风格/格式调整
- `refactor`：重构（不修复缺陷也不新增功能）
- `perf`：性能优化
- `test`：测试相关
- `build`：构建系统或依赖变更
- `ci`：CI 配置或脚本变更
- `chore`：日常维护或杂项
- `revert`：回滚提交
- `merge`：合并分支

说明：`Merge ...` 自动合并提交会被忽略校验。

## Scope 规范

- Scope 允许为空（可省略）。
- 推荐范围（与交互式提交保持一致）：
  - `app` / `ui` / `config` / `tooling` / `docs` / `tests` / `ci`
- 允许自定义 scope，但需与变更模块一致。

## Subject 规范

- 必填，动词开头，表意清晰。
- 不使用句号 `.` 结尾。
- 最大长度：114 字符。

## Body / Footer（可选）

- Body：建议说明“为什么改、怎么改”。
- Footer：用于关联 issue/任务（如 `Closes #123`）。

## 分支命名规范

**功能分支（最常用）**

- `develop-{开发者名字}`（如 `develop-moxiaoshuai`）
- `feature/{功能描述}`（如 `feature/login-redesign`）
- `feat/{模块}`（如 `feat/login`）

**修复分支**

- `hotfix/{问题描述}`（如 `hotfix/login-bug`）
- `fix/{模块}`（如 `fix/contract-validate`）

**发布分支**

- `release/{版本号}`（如 `release/1.1.7`）

**测试分支**

- `test/{版本或功能}`（如 `test/login-flow`）

**内测分支**

- `alpha/{版本}`（如 `alpha/0.0.1`)
