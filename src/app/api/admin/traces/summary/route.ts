import { NextRequest, NextResponse } from "next/server";

import {
  getBearerToken,
  unauthorizedAdminResponse,
  validateAdminToken,
} from "@/app/api/admin/_shared/auth";
import { fetchTraceSuccessSummary, type TraceWindow } from "@/app/api/admin/traces/_shared";

const TRACE_WINDOWS = new Set<TraceWindow>(["1h", "24h", "7d"]);

const readTraceWindow = (value: string | null): TraceWindow =>
  TRACE_WINDOWS.has(value as TraceWindow) ? (value as TraceWindow) : "1h";

const readLimit = (value: string | null): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return Math.min(200, Math.max(1, Math.trunc(parsed)));
};

export async function GET(request: NextRequest): Promise<Response> {
  const authorized = await validateAdminToken(getBearerToken(request));
  if (!authorized) {
    return unauthorizedAdminResponse();
  }

  const params = request.nextUrl.searchParams;
  try {
    const summary = await fetchTraceSuccessSummary({
      service: params.get("service")?.trim() || undefined,
      operation: params.get("operation")?.trim() || undefined,
      window: readTraceWindow(params.get("window")),
      limit: readLimit(params.get("limit")),
    });
    return NextResponse.json({ code: 200, msg: "success", data: { summary } });
  } catch (error) {
    return NextResponse.json(
      {
        code: 503,
        msg: error instanceof Error ? error.message : "观测汇总暂时不可用",
        data: null,
      },
      { status: 503 },
    );
  }
}
