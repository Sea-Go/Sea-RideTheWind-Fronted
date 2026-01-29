import Image from "next/image";

interface CardProps {
  title: string;
  image?: string | null;
  author: string;
  likes: number;
  content: string;
}

export const Card = ({ title, image, author, likes, content }: CardProps) => {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
      {image && (
        <div className="relative h-64 w-full">
          <Image
            src={image}
            alt={title}
            fill
            style={{ objectFit: "cover" }}
            className="rounded-t-lg"
          />
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
