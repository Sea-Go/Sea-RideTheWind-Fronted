# AI 文献摘要与封面生成系统分析与设计（系分）

## 1. 系统目标

设计一套可扩展、可解释的 AI 管道系统，用于：

- 对长文献进行语义理解与结构化摘要
- 基于摘要生成高质量封面图片
- 支持后续 Agent / 多模态能力扩展

## 2. 总体架构

### 2.1 架构概览

```
[客户端]
   ↓
[API Gateway]
   ↓
[文献处理服务]
   ↓
[摘要生成服务] ——→ [摘要存储]
   ↓
[封面 Prompt 生成服务]
   ↓
[图像生成服务]
   ↓
[结果存储 / CDN]
```

核心思想：**两阶段 AI Pipeline，文本与视觉解耦**。

## 3. 模块设计

### 3.1 文献处理服务

职责：

- 文件解析（PDF / Markdown / Text）
- 文本清洗（去页眉页脚、引用噪音）
- 长文分段（Chunking）

关键策略：

- Chunk Size：1k~2k tokens
- 保留段落顺序与层级信息

### 3.2 摘要生成服务（LLM-1）

职责：

- 对分段内容进行语义理解
- 生成结构化摘要 JSON

实现方式：

- Map 阶段：Chunk → 局部摘要
- Reduce 阶段：合并为全局摘要

输出示例：

```json
{
  "title": "...",
  "domain": "...",
  "core_problem": "...",
  "key_contribution": ["..."],
  "keywords": ["..."],
  "tone": "academic"
}
```

### 3.3 摘要存储

- 存储结构化摘要（JSON）
- 支持版本号（原始 / 用户编辑后）
- 作为后续生成的唯一语义来源

### 3.4 封面 Prompt 生成服务（LLM-2）

职责：

- 将结构化摘要转为图像生成 Prompt
- 注入设计约束（比例、风格）

特点：

- 不直接生成图片
- 只负责“视觉语义编排”

### 3.5 图像生成服务

- 对接第三方图像生成模型
- 输入：Prompt + 参数（size、style）
- 输出：封面图片 URL

## 4. 数据流说明

1. 用户提交文献
2. 文献处理服务解析并分段
3. 摘要生成服务输出结构化摘要
4. 用户可选编辑摘要
5. 封面 Prompt 服务生成 Prompt
6. 图像生成服务生成封面
7. 返回结果给客户端

## 5. 关键设计决策

### 5.1 为什么结构化摘要是核心

- 是系统的“语义中枢”
- 可缓存、可编辑、可复用
- 支撑多下游能力（封面 / 视频 / PPT）

### 5.2 为什么拆成两个模型

- 降低单模型复杂度
- 提升可控性与调试能力
- 控制成本（摘要贵、封面便宜）

## 6. 异常与边界处理

- 文献过短：直接全量摘要
- 文献解析失败：返回错误状态
- 模型输出不合法 JSON：重试 / 校验

## 7. 可扩展方向

- 多语言摘要生成
- 多风格封面（科技 / 插画 / 商务）
- 视频封面 / PPT 首页生成
- Agent 化：自动选择摘要深度与风格

## 8. 技术选型建议（示例）

- LLM：高质量通用大模型（摘要）+ 轻量模型（Prompt）
- 存储：JSON 文档型数据库
- 图片：第三方图像生成 API
- 调度：异步任务 + 状态轮询

## 9. 当前项目落地映射（本地存储版）

为贴合本项目现状，系统采用与本系分一致的分层思路，但将“CDN/对象存储”替换为
`public` 目录本地存储。

### 9.1 分层与代码映射

- 文献处理服务：`src/lib/pipeline/document-processor.ts`
  - 负责 Markdown 清洗与分段。
- 摘要生成服务：`src/lib/pipeline/summary-service.ts`
  - 负责生成结构化摘要（标题、领域、核心问题、贡献、关键词、语气）。
- 摘要存储：`src/lib/pipeline/storage-service.ts`
  - 将摘要以 JSON 形式存储到 `public/summaries/*`。
- 封面 Prompt 生成服务：`src/lib/pipeline/prompt-service.ts`
  - 将结构化摘要转换为文生图 Prompt。
- 图像生成服务：`src/lib/pipeline/image-service.ts`
  - 对接 DashScope 文生图并下载图片二进制。
- 结果存储：`src/lib/pipeline/storage-service.ts`
  - 将封面图片存储到 `public/covers/*`。
- Pipeline 编排：`src/lib/pipeline/cover-pipeline.ts`
  - 按“处理→摘要→摘要存储→Prompt→图像生成→结果存储”顺序执行。

### 9.2 接口与发布链路映射

- 手动生成封面接口：`src/app/api/cover/generate/route.ts`
  - 调用 Pipeline 返回 `cover`，并附带 `summary`、`summaryPath`。
- 发布接口：`src/app/api/publish/route.ts`
  - 若用户未上传封面，自动触发 Pipeline 生成；
  - 文章仍写入 `public/*.md`，并在可用时写入 `summaryPath` frontmatter。

### 9.3 与原系分差异说明

- 保持一致：分层职责、两阶段语义（先摘要再 Prompt）、可扩展的流水线设计。
- 本地化差异：
  - `结果存储 / CDN` 当前落地为 `public/covers/*`；
  - `摘要存储` 当前落地为 `public/summaries/*`；
  - 后续可在不改上层接口的前提下平滑替换为 OSS/CDN。
