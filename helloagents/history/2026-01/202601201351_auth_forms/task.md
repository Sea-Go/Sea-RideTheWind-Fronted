# 任务清单: 登录与注册表单组件

目录: `helloagents/plan/202601201351_auth_forms/`

---

## 1. 登录表单组件

- [√] 1.1 在 `src/components/common/LoginForm.tsx`
  中实现登录表单与交互逻辑，验证 why.md#需求-登录表单-场景-正常登录
- [√] 1.2 在 `src/app/login/page.tsx`
  中更新组件命名与引用，验证 why.md#需求-登录表单-场景-正常登录，依赖任务1.1

## 2. 注册表单组件

- [√] 2.1 在 `src/components/common/RegisterForm.tsx`
  中实现注册表单与交互逻辑，验证 why.md#需求-注册表单-场景-注册成功跳转

## 3. 安全检查

- [√] 3.1 执行安全检查（按G9: 输入验证、敏感信息处理、权限控制、EHRB风险规避）

## 4. 文档更新

- [√] 4.1 更新 `helloagents/wiki/modules/` 中相关模块文档（如存在）

## 5. 测试

- [-] 5.1 手动验证登录与注册流程的表单校验、密码可见切换与跳转
  > 备注: 未执行手动验证。
