const typeEnum = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
  "merge",
];

module.exports = {
  rules: {
    "type-enum": [2, "always", typeEnum],
    "subject-empty": [2, "never"],
    "subject-max-length": [2, "always", 114],
    "subject-full-stop": [2, "never", "."],
  },
  prompt: {
    types: [
      { value: "feat", name: "feat: 新增功能" },
      { value: "fix", name: "fix: 修复缺陷" },
      { value: "docs", name: "docs: 仅文档变更" },
      { value: "style", name: "style: 代码风格/格式调整" },
      { value: "refactor", name: "refactor: 重构（不修复缺陷也不新增功能）" },
      { value: "perf", name: "perf: 性能优化" },
      { value: "test", name: "test: 测试相关" },
      { value: "build", name: "build: 构建系统或依赖变更" },
      { value: "ci", name: "ci: CI 配置或脚本变更" },
      { value: "chore", name: "chore: 日常维护或杂项" },
      { value: "revert", name: "revert: 回滚提交" },
      { value: "merge", name: "merge: 合并分支" },
    ],
    scopes: ["app", "ui", "config", "tooling", "docs", "tests", "ci"],
    allowCustomScopes: true,
    allowEmptyScopes: true,
    subjectLimit: 114,
  },
};
