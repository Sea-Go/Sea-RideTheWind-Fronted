import Image from "next/image";
import { useState } from "react";

interface CardProps {
  title: string;
  image?: string | null;
  author: string;
  likes: number;
  content: string;
}

export const Card = ({ title, image, author, likes, content }: CardProps) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    console.error(`图片加载失败详情:`, {
      src: image,
      naturalWidth: target.naturalWidth,
      naturalHeight: target.naturalHeight,
      errorMessage: (target as any).error?.message || "未知错误",
    });
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    console.log(`图片加载成功: ${image}`);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
      {image && !imageError && (
        <div className="relative w-full">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="animate-pulse text-sm text-gray-400">加载中...</div>
            </div>
          )}
          <Image
            src={image}
            alt={title}
            width={400}
            height={300}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="h-auto w-full rounded-t-lg object-cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
            priority={false}
            quality={85}
            unoptimized={true}
          />
        </div>
      )}
      {imageError && (
        <div className="relative flex h-48 w-full flex-col items-center justify-center bg-gray-100 p-4">
          <span className="mb-2 text-sm text-gray-400">图片加载失败</span>
          <span className="text-xs text-gray-500">路径: {image}</span>
          <button
            className="mt-2 rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
            onClick={() => {
              setImageError(false);
              setImageLoading(true);
            }}
          >
            重试
          </button>
        </div>
      )}
      <div className="p-4">
        <h3 className="mb-2 text-sm leading-tight font-semibold text-gray-900">{title}</h3>
        <p className="mb-3 line-clamp-2 text-xs text-gray-600">{content}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{author}</span>
          <span className="flex items-center">
            <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.253A8.014 8.014 0 0117.747 8H12V2.253z" />
            </svg>
            {likes}
          </span>
        </div>
      </div>
    </div>
  );
};
