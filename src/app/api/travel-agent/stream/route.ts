import { NextRequest, NextResponse } from "next/server";

import { getTravelAgentServerUrl, resolveTravelAgentUserId } from "../_shared";

export async function POST(request: NextRequest): Promise<Response> {
  let serverUrl: string;
  let userId: string;
  try {
    serverUrl = getTravelAgentServerUrl();
    userId = await resolveTravelAgentUserId(request);
  } catch (error) {
    return NextResponse.json(
      { code: 500, msg: error instanceof Error ? error.message : "旅行规划服务未配置" },
      { status: 500 },
    );
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    payload.userId = userId;
    const upstreamResponse = await fetch(`${serverUrl}/travel/stream`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: request.signal,
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        "content-type": upstreamResponse.headers.get("content-type") ?? "text/event-stream",
        "cache-control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("Failed to proxy travel agent stream:", error);
    return NextResponse.json({ code: 502, msg: "旅行规划服务暂时不可用" }, { status: 502 });
  }
}
