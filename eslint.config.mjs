// ESLint 配置：集成 Next.js 与 Prettier
// Next.js 官方基础规则
import nextConfig from "eslint-config-next";
// 关闭与 Prettier 冲突的规则
import eslintConfigPrettier from "eslint-config-prettier";
// 将 Prettier 结果作为 ESLint 规则
import prettierPlugin from "eslint-plugin-prettier";
// 导入排序插件
import simpleImportSort from "eslint-plugin-simple-import-sort";

const config = [
  // Next.js 推荐规则
  ...nextConfig,
  // 关闭与 Prettier 冲突的 ESLint 规则
  eslintConfigPrettier,
  {
    plugins: {
      // Prettier 规则插件
      prettier: prettierPlugin,
      // 导入/导出排序插件
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // 将 Prettier 格式问题作为警告提示
      "prettier/prettier": "warn",
      // 导入排序规则
      "simple-import-sort/imports": [
        "warn",
        {
          groups: [["^\\u0000"], ["^node:", "^@?\\w"], ["^@/"], ["^\\."], ["^.+\\.s?css$"]],
        },
      ],
      // 导出排序规则
      "simple-import-sort/exports": "warn",
    },
  },
];

export default config;
