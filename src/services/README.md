# API 服务 (Services)

这里存放与后端交互的代码，通常是对 fetch 或 axios 的封装以及具体的 API 调用函数。

## 结构建议

建议按业务模块划分文件。

## 示例

- `auth.ts` (登录、注册接口)
- `user.ts` (用户信息接口)
- `request.ts` (基础请求封装)
