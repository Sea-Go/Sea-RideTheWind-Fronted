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

## 环境变量

- 在项目根目录创建 `.env.local`
- 配置阿里 DashScope 密钥（仅服务端使用）：`DASHSCOPE_API_KEY=你的密钥`

## 质量与格式化

- 统一校验：pnpm lint ---- ESLint：pnpm lint:eslint & Stylelint：pnpm lint:style
- 类型检查：pnpm typecheck
- 格式检查：pnpm format:check
- 统一修复：pnpm fix ---- eslint . --fix & pnpm format

## 提交代码

- 交互式提交：pnpm cz
- 提交流程：doc/代码提交与协作流程.md
- 提交规范：doc/git规范.md

## 目录速览

- src/app：页面与布局
- src/components：组件
- src/lib：工具与通用逻辑

## AI 封面流水线（当前实现）

### 架构图（本地存储版）

```text
[客户端]
	↓
[API Gateway]
	↓
[文献处理服务]
	↓
[摘要生成服务] ——→ [摘要存储（public/summaries）]
	↓
[封面 Prompt 生成服务]
	↓
[图像生成服务]
	↓
[结果存储（public/covers + public/*.md）]
```

### 模块映射表

| 阶段        | 代码位置                                 | 产物                              |
| ----------- | ---------------------------------------- | --------------------------------- |
| 文献处理    | `src/lib/pipeline/document-processor.ts` | 清洗文本 + 分段结果               |
| 摘要生成    | `src/lib/pipeline/summary-service.ts`    | 结构化摘要对象                    |
| 摘要存储    | `src/lib/pipeline/storage-service.ts`    | `public/summaries/*.json`         |
| Prompt 生成 | `src/lib/pipeline/prompt-service.ts`     | 文生图 Prompt                     |
| 图像生成    | `src/lib/pipeline/image-service.ts`      | 图片二进制数据                    |
| 结果存储    | `src/lib/pipeline/storage-service.ts`    | `public/covers/*` + 发布 Markdown |
| 编排入口    | `src/lib/pipeline/cover-pipeline.ts`     | 串联完整流水线                    |

### 接口入口

- 手动生成封面：`src/app/api/cover/generate/route.ts`
- 发布时自动兜底生成：`src/app/api/publish/route.ts`

详细设计映射见：`doc/ai文献摘要与封面生成_系统分析与设计.md`（第 9 节）。
