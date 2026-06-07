import { ArrowRightIcon, PenBoxIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { Layout } from "@/components/layout/layout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <Layout>
      <PageContainer className="py-10 sm:py-14">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.1fr)_380px]">
          <Card className="app-hero-surface overflow-hidden shadow-xl">
            <CardContent className="relative space-y-6 p-8 sm:p-10">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.2),transparent_62%)]"
              />
              <div className="relative space-y-4">
                <p className="app-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                  <SparklesIcon className="size-3.5" />
                  识海社区
                </p>
                <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
                  一个更安静、更清爽的内容社区
                </h1>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/dashboard/recommend">
                    进入推荐页
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/post">
                    <PenBoxIcon className="size-4" />
                    去发布
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="app-surface-elevated shadow-lg">
              <CardContent className="flex items-center gap-3 p-5">
                <span className="bg-primary/12 text-primary inline-flex size-11 items-center justify-center rounded-2xl">
                  <PenBoxIcon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">创作</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </Layout>
  );
}
