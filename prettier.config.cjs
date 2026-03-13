// Prettier 格式化配置（含 Tailwind 类名排序）
module.exports = {
  // 单行最大长度
  printWidth: 100,
  // 缩进宽度
  tabWidth: 2,
  // 使用空格缩进而非 Tab
  useTabs: false,
  // 使用双引号
  singleQuote: false,
  // 语句末尾使用分号
  semi: true,
  // 多行时保留尾逗号
  trailingComma: "all",
  // 对象花括号内保留空格
  bracketSpacing: true,
  // JSX 的 > 不与最后一个属性同一行
  bracketSameLine: false,
  // 箭头函数参数始终带括号
  arrowParens: "always",
  // Markdown 文本换行策略（保留原样）
  proseWrap: "preserve",
  // 仅在必要时给对象键添加引号
  quoteProps: "as-needed",
  // 使用 LF 换行
  endOfLine: "lf",
  // 嵌入语言格式化策略
  embeddedLanguageFormatting: "auto",
  // JSX 单个属性不强制独占一行
  singleAttributePerLine: false,
  // 启用 Tailwind 类名排序插件
  plugins: ["prettier-plugin-tailwindcss"],
  // 针对 Markdown 使用更窄行宽与自动换行
  overrides: [
    {
      files: ["*.md", "*.mdx"],
      options: {
        printWidth: 80,
        proseWrap: "always",
      },
    },
  ],
};
