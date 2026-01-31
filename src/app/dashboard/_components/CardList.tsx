// import { useEffect, useState } from "react";
import Masonry from "react-masonry-css";

// import Image from "next/image";
import { Card } from "./Card";

const mockPosts = [
  {
    title: "上海有没有缺正片后勤/机位二的coser老师",
    image: "/assets/images/a.jpg",
    author: "一个小方",
    likes: 2,
    content: "是摄影新人和一个路人coser，如果是熟悉的ip可以来当无偿... ",
  },
  {
    title: "冬日，阳光，与JK",
    image: "/assets/images/0068albMly1hxr5qe9nkvj30j60srac4.jpg",
    author: "JunYee",
    likes: 727,
    content: "冬天的阳光洒在校园里，JK制服随风飘动...",
  },
  {
    title: "某安全大厂前端实习二面",
    image: "/assets/images/701D6B7350809E3BD8C53D4AD822C9A8.png",
    author: "好困qst",
    likes: 2,
    content: "面试官问了Vue响应式原理，我答得有点懵...",
  },
  {
    title: "北京扫街小分队！2025下半年扫街结算",
    image: "/assets/images/5657f0f1f5be44a17c35be830e79df84.jpg",
    author: "玉米玉米",
    likes: 53,
    content: "记录下每个城市的街头角落，拍出不一样的烟火气。",
  },
  {
    title: "成都今天有没有来出差，或者来成都旅游的呀",
    image: "/assets/images/c4458f087a48f121be885aa09e996c02.jpg",
    author: "小红薯",
    likes: 3,
    content: "调休了在家呆着太无聊啦，一起出来玩呀，面基，面基，面基",
  },
];

export const CardList = () => {
  return (
    <Masonry
      breakpointCols={{
        default: 5,
        1400: 4,
        1200: 3,
        900: 2,
        600: 1,
      }}
      className="my-masonry-grid"
      columnClassName="my-masonry-grid-column"
    >
      {mockPosts.map((post, index) => (
        <div key={index} className="mb-4">
          <Card {...post} />
        </div>
      ))}
    </Masonry>
  );
};
