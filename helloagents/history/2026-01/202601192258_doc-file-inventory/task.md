# 任务清单: 文档清单与测试/CI清理

目录: `helloagents/plan/202601192258_doc-file-inventory/`

---

## 1. 文档清单

- [√] 1.1 在 `doc/文件用途清单.md`
  中整理并写入项目文件用途清单，验证 why.md#需求-文件用途清单-场景-文档补充

## 2. 移除 CI

- [√] 2.1 删除 `.github/workflows/ci.yml`，如 `.github/`
  为空则移除目录，验证 why.md#需求-移除测试与ci-场景-轻量化工程配置

## 3. 移除测试文件与配置

- [√] 3.1 删除 `vitest.config.ts` 与
  `playwright.config.ts`，验证 why.md#需求-移除测试与ci-场景-轻量化工程配置
- [√] 3.2 删除 `tests/`、`src/__tests__/` 与
  `src/test/`，验证 why.md#需求-移除测试与ci-场景-轻量化工程配置
- [√] 3.3 更新
  `package.json`（移除 test/e2e 脚本与测试相关依赖），验证 why.md#需求-移除测试与ci-场景-轻量化工程配置
- [√] 3.4 更新 `.husky/pre-push`
  移除测试命令调用，验证 why.md#需求-移除测试与ci-场景-轻量化工程配置

## 4. 知识库同步

- [√] 4.1 在 `helloagents/wiki/modules/docs.md`
  中补充新文档描述，验证 why.md#需求-文件用途清单-场景-文档补充
- [√] 4.2 在 `helloagents/wiki/modules/quality.md`
  中说明测试与CI暂不启用，验证 why.md#需求-移除测试与ci-场景-轻量化工程配置

## 5. 安全检查

- [√] 5.1 执行安全检查（按G9: 输入验证、敏感信息处理、权限控制、EHRB风险规避）
  > 备注: 未发现敏感信息或危险操作。

## 6. 文档更新

- [√] 6.1 更新 `helloagents/CHANGELOG.md`

## 7. 测试

- [√] 7.1 标记无需测试（文档与配置清理）
  > 备注: 项目已移除测试体系，未执行测试。
