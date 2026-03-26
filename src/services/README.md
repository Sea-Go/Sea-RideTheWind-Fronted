# API 链接层

这里存放前端和后端交互的服务封装，通常是对 `fetch`
的二次包装，以及业务接口调用函数。

## 建议结构

按业务模块拆分文件，避免把所有接口都堆在一个文件里。

## 当前服务

- `auth.ts`
- `admin.ts`
- `article.ts`
- `comment.ts`
- `like.ts`
- `follow.ts`
- `task.ts`
- `reco.ts`
- `request.ts`
