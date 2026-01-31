// 自定义图片加载器（暂时保留，但不在next.config.ts中使用）
// 如果将来需要自定义图片处理逻辑，可以在这里实现

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  // 对于本地静态资源，直接返回原路径
  if (src.startsWith("/assets/")) {
    return src;
  }
  // 对于其他资源，可以添加查询参数
  return `${src}?w=${width}&q=${quality || 75}`;
}
