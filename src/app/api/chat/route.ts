import { NextRequest, NextResponse } from "next/server";

// 学习问答 BFF：POST /api/chat 以 SSE 流式透传产品服务 A1 `POST /api/v1/chat`。
// 沿用 /api/sea 的既有模式：未配置 SEA_PRODUCT_API_SERVER_URL 时返回 503
// envelope；取消信号贯通（客户端断开 → 499）；event-stream 响应关闭代理
// 缓冲（X-Accel-Buffering: no），保证增量按时到达浏览器。
// 上游未实现时（404/501 等）原样透传状态与正文，前端按 error 事件处理。
const UPSTREAM_CHAT_PATH = "/api/v1/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unavailable = () =>
  NextResponse.json(
    {
      code: 503,
      msg: "产品服务尚未配置，请设置 SEA_PRODUCT_API_SERVER_URL",
      data: null,
    },
    { status: 503 },
  );

export async function POST(request: NextRequest) {
  const base = process.env.SEA_PRODUCT_API_SERVER_URL;
  if (!base) return unavailable();

  const headers = new Headers({
    Accept: request.headers.get("accept") || "text/event-stream",
    "Content-Type": request.headers.get("content-type") || "application/json",
  });
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  try {
    const upstream = await fetch(`${base.replace(/\/$/, "")}${UPSTREAM_CHAT_PATH}`, {
      method: "POST",
      headers,
      body: await request.text(),
      signal: request.signal,
      cache: "no-store",
    });
    const responseHeaders = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-store, no-transform",
    });
    if (responseHeaders.get("Content-Type")?.includes("event-stream"))
      responseHeaders.set("X-Accel-Buffering", "no");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (e) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json(
      { code: 502, msg: e instanceof Error ? e.message : "上游暂不可用", data: null },
      { status: 502 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { code: 405, msg: "仅支持 POST（SSE 流式问答）", data: null },
    { status: 405 },
  );
}
