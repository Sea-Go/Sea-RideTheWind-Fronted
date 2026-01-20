import Link from "next/link";

function Navbar() {
  return (
    <nav className="flex gap-4 border-b p-4">
      <Link href="/">首页</Link>
      <Link href="/login">登录</Link>
      <Link href="/explore">发现</Link>
    </nav>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 flex-col items-center justify-center p-24">
        <h1 className="text-4xl font-bold">Hello Sea-TryGo!</h1>
      </div>
    </main>
  );
}
