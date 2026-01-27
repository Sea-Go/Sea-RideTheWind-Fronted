import { Card } from "./Card";

const mockPosts = [
  {
    title: "上海有没有缺正片后勤/机位二的coser老师",
    image: "/assets/images/etiwh.jpg",
    author: "一个小方",
    likes: 2,
    content: "是摄影新人和一个路人coser，如果是熟悉的ip可以来当无偿... ",
  },
  {
    title: "冬日，阳光，与JK",
    image: "/assets/images/white.jpg",
    author: "JunYee",
    likes: 727,
    content: "冬天的阳光洒在校园里，JK制服随风飘动...",
  },
  {
    title: "某安全大厂前端实习二面",
    image: null,
    author: "好困qst",
    likes: 2,
    content: "面试官问了Vue响应式原理，我答得有点懵...",
  },
  {
    title: "北京扫街小分队！2025下半年扫街结算",
    image: "/assets/images/etiwh.jpg",
    author: "玉米玉米",
    likes: 53,
    content: "记录下每个城市的街头角落，拍出不一样的烟火气。",
  },
  {
    title: "成都今天有没有来出差，或者来成都旅游的呀",
    image: null,
    author: "小红薯",
    likes: 3,
    content: "调休了在家呆着太无聊啦，一起出来玩呀，面基，面基，面基",
  },
];

export const CardList = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {mockPosts.map((post, index) => (
        <Card key={index} {...post} />
      ))}
    </div>
  );
};
