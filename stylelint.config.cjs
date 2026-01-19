// Stylelint 配置：标准规则 + Tailwind
module.exports = {
  // 继承标准规则集与 Tailwind 规则集
  extends: ["stylelint-config-standard", "stylelint-config-tailwindcss"],
  // 忽略 JS/TS 与构建产物目录，避免误报
  ignoreFiles: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx", "**/.next/**", "**/node_modules/**"],
  rules: {
    // 允许色相角度的任意写法（关闭强制格式）
    "hue-degree-notation": null,
    // 允许亮度表示的任意写法（关闭强制格式）
    "lightness-notation": null,
    // 关闭规则前必须空行的要求
    "rule-empty-line-before": null,
  },
};
