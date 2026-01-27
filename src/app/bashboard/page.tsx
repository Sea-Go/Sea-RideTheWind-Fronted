// 首页主页面组件（核心）

// src/app/dashboard/page.tsx
import CardList from "@/components/common/CardList";
import SearchBar from "@/components/common/SearchBar";
import Tabs from "@/components/common/Tabs";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <SearchBar />
        <Tabs />
        <CardList />
      </main>
      <Footer />
    </div>
  );
}
