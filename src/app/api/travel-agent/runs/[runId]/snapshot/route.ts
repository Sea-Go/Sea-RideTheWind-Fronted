import { NextRequest, NextResponse } from "next/server";

import { appendUserId, getTravelAgentServerUrl, resolveTravelAgentUserId } from "../../../_shared";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { runId } = await context.params;

  try {
    const serverUrl = getTravelAgentServerUrl();
    const userId = await resolveTravelAgentUserId(request);
    const upstreamUrl = appendUserId(
      new URL(`${serverUrl}/travel/runs/${encodeURIComponent(runId)}/snapshot`),
      userId,
    );
    for (const key of ["level", "parentNodeId"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) {
        upstreamUrl.searchParams.set(key, value);
      }
    }
    const upstreamResponse = await fetch(upstreamUrl, { cache: "no-store" });
    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("Failed to proxy travel agent snapshot:", error);
    return NextResponse.json({ code: 502, msg: "旅行规划快照暂时不可用" }, { status: 502 });
  }
}
