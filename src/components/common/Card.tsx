// 内容卡片组件

// src/components/common/Card.tsx
interface CardProps {
  title: string;
  image?: string;
  author: string;
  likes: number;
  content: string;
}

export default function Card({ title, image, author, likes, content }: CardProps) {
  return (
    <div className="rounded-lg border bg-white shadow-sm transition duration-200 hover:shadow-md">
      {image && <img src={image} alt="" className="h-48 w-full rounded-t-lg object-cover" />}
      <div className="p-4">
        <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
        <p className="mb-3 text-sm text-gray-600">{content}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{author}</span>
          <span>❤️ {likes}</span>
        </div>
      </div>
    </div>
  );
}
