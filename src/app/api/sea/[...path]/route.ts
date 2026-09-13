import { NextRequest, NextResponse } from "next/server";
// Proposed RTW product contracts. No upstream configured => explicit unavailable. Never synthesizes success.
const allowed =
  /^(?:knowledge\/modules(?:\/[^/]+(?:\/(?:sources|releases(?:\/current)?|activation|wiki-pages(?:\/[^/]+(?:\/revisions)?)?))?)?|knowledge\/releases\/[^/]+\/index-builds|learning\/conversations(?:\/[^/]+\/messages)?|learning\/answers\/[^/]+(?:\/(?:cancel|citations\/[^/]+))?|intelligence\/(?:search|recommendations))$/;
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathname = path.map(encodeURIComponent).join("/");
  if (!allowed.test(pathname))
    return NextResponse.json({ code: 404, msg: "未知产品契约路径", data: null }, { status: 404 });
  const base = process.env.SEA_PRODUCT_API_SERVER_URL;
  if (!base)
    return NextResponse.json(
      {
        code: 503,
        msg: "知识与全站学习产品接口待接入，请配置 SEA_PRODUCT_API_SERVER_URL 并核对接口草案",
        data: null,
      },
      { status: 503 },
    );
  const token =
    request.headers.get("authorization") ||
    (request.cookies.get("user_center_token")?.value &&
      `Bearer ${request.cookies.get("user_center_token")?.value}`) ||
    (request.cookies.get("admin_center_token")?.value &&
      `Bearer ${request.cookies.get("admin_center_token")?.value}`);
  const headers = new Headers({
    Accept: request.headers.get("accept") || "application/json",
    "Content-Type": request.headers.get("content-type") || "application/json",
  });
  if (token) headers.set("Authorization", token);
  try {
    const upstream = await fetch(
      `${base.replace(/\/$/, "")}/v1/${pathname}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
        signal: request.signal,
        cache: "no-store",
      },
    );
    const responseHeaders = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "application/json",
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
export const POST = GET;
export const PUT = GET;
