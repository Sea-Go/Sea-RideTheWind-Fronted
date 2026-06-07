import { NextResponse } from "next/server";

import { getTravelAgentServerUrl } from "../../../_shared";

interface RouteContext {
  params: Promise<{ routeId: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { routeId } = await context.params;

  try {
    const serverUrl = getTravelAgentServerUrl();
    const upstreamResponse = await fetch(
      `${serverUrl}/travel/routes/${encodeURIComponent(routeId)}/polyline`,
      { cache: "no-store" },
    );
    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("Failed to proxy travel agent route polyline:", error);
    return NextResponse.json({ code: 502, msg: "路线轨迹暂时不可用" }, { status: 502 });
  }
}
