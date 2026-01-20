# 技术设计: 登录页布局与动画复刻

## 技术方案

### 核心技术

- Next.js (App Router) + React
- TypeScript
- Tailwind CSS

### 实现要点

- 使用 `useState` 控制登录/注册模式
- 使用容器 class 切换动画状态（仿 Vue `sign-up-mode`）
- 以 Tailwind 与内联样式复刻布局与关键动效
- 图片区域使用占位容器，后续由用户替换
- 引用 `LoginForm` 与 `RegisterForm` 组件

## 安全与性能

- **安全:** 仅页面布局与交互切换，无敏感信息处理
- **性能:** CSS 动画与布局变更，风险可控

## 测试与部署

- **测试:** 手动验证模式切换、布局与响应式
- **部署:** 无额外部署流程
