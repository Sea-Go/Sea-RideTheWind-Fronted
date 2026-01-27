// 内容列表

// src/components/common/CardList.tsx
import Card from "./Card";

const mockPosts = [
  {
    title: "上海有没有缺正片后勤/机位二的coser老师",
    image: "https://picsum.photos/seed/1/300/200",
    author: "一个小方",
    likes: 2,
    content: "是摄影新人和一个路人coser，如果是熟悉的ip可以来当无偿...",
  },
  {
    title: "冬日，阳光，与JK",
    image: "https://picsum.photos/seed/2/300/200",
    author: "JunYee",
    likes: 727,
    content: "今天天气真好，阳光洒在身上暖暖的。",
  },
  {
    title: "某安全大厂前端实习二面",
    image: "https://picsum.photos/seed/3/300/200",
    author: "好困qst",
    likes: 2,
    content: "面试官问了Vue响应式原理，我答得有点磕巴...",
  },
];

export default function CardList() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {mockPosts.map((post, index) => (
        <Card key={index} {...post} />
      ))}
    </div>
  );
}
