# API 服务 (Services)

这里存放与后端交互的代码，通常是对 fetch 或 axios 的封装以及具体的 API 调用函数。

## 结构建议

建议按业务模块划分文件。

## 示例

- `auth.ts` (登录、注册接口)
- `admin.ts` (管理员相关接口)
- `article.ts` (文章相关接口)
- `comment.ts` (评论相关接口)
- `like.ts` (点赞相关接口)
- `task.ts` (任务相关接口)
- `reco.ts` (推荐服务接口：recommend/ingest/tools/health)
- `request.ts` (基础请求封装)
