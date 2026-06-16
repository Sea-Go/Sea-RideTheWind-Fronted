import { NextRequest, NextResponse } from "next/server";

import {
  getBearerToken,
  unauthorizedAdminResponse,
  validateAdminToken,
} from "@/app/api/admin/_shared/auth";
import { fetchTraceDetail } from "@/app/api/admin/traces/_shared";

interface TraceDetailRouteContext {
  params: Promise<{
    traceId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: TraceDetailRouteContext,
): Promise<Response> {
  const authorized = await validateAdminToken(getBearerToken(request));
  if (!authorized) {
    return unauthorizedAdminResponse();
  }

  const { traceId } = await context.params;
  if (!traceId.trim()) {
    return NextResponse.json({ code: 400, msg: "traceId 不能为空", data: null }, { status: 400 });
  }

  try {
    const trace = await fetchTraceDetail(traceId);
    return NextResponse.json({ code: 200, msg: "success", data: { trace } });
  } catch (error) {
    return NextResponse.json(
      {
        code: 503,
        msg: error instanceof Error ? error.message : "Jaeger 服务暂时不可用",
        data: null,
      },
      { status: 503 },
    );
  }
}
