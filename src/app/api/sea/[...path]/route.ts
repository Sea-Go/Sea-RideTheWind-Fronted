import { NextRequest, NextResponse } from "next/server";

import {
  hasAllowedHistoryQuery,
  isKnowledgeHistoryRead,
  knowledgeHistoryVersion,
} from "@/server/knowledge-history-version";
import { isKnowledgeRoute } from "@/server/knowledge-routes";
// Knowledge paths are generated from RTW. Other product interfaces remain separate. No fixtures.
const allowed =
  /^(?:learning\/conversations(?:\/[^/]+\/messages)?|learning\/answers\/[^/]+(?:\/(?:cancel|citations\/[^/]+))?|intelligence\/(?:search|recommendations))$/;
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathname = path.map(encodeURIComponent).join("/");
  if (
    !(pathname.startsWith("knowledge/")
      ? isKnowledgeRoute(pathname, request.method)
      : allowed.test(pathname))
  )
    return NextResponse.json({ code: 404, msg: "未知产品契约路径", data: null }, { status: 404 });
  const version = knowledgeHistoryVersion(pathname, request.method);
  if (version === "invalid")
    return NextResponse.json(
      { code: 503, msg: "SEA_KNOWLEDGE_HISTORY_READ_VERSION 仅支持 v1 或 v2", data: null },
      { status: 503 },
    );
  if (
    isKnowledgeHistoryRead(pathname, request.method) &&
    !hasAllowedHistoryQuery(pathname, request.nextUrl.searchParams)
  )
    return NextResponse.json(
      { code: 400, msg: "知识历史只接受分页参数", data: null },
      { status: 400 },
    );
  const token =
    request.headers.get("authorization") ||
    (request.cookies.get("user_center_token")?.value &&
      `Bearer ${request.cookies.get("user_center_token")?.value}`) ||
    (!pathname.startsWith("knowledge/answer-sessions/") &&
      request.cookies.get("admin_center_token")?.value &&
      `Bearer ${request.cookies.get("admin_center_token")?.value}`);
  if (version === "v2" && (!token || !/^Bearer\s+\S+$/i.test(token)))
    return NextResponse.json(
      { code: 401, msg: "知识历史 v2 需要 User JWT", data: null },
      { status: 401 },
    );
  const base = process.env.SEA_PRODUCT_API_SERVER_URL;
  if (!base)
    return NextResponse.json(
      {
        code: 503,
        msg: "产品服务尚未配置，请设置 SEA_PRODUCT_API_SERVER_URL",
        data: null,
      },
      { status: 503 },
    );
  const headers = new Headers({
    Accept: request.headers.get("accept") || "application/json",
    "Content-Type": request.headers.get("content-type") || "application/json",
  });
  if (token) headers.set("Authorization", token);
  try {
    const upstream = await fetch(
      `${base.replace(/\/$/, "")}/${version}/${pathname}${request.nextUrl.search}`,
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
