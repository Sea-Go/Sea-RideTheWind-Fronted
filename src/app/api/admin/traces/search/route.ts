import { NextRequest, NextResponse } from "next/server";

import {
  getBearerToken,
  unauthorizedAdminResponse,
  validateAdminToken,
} from "@/app/api/admin/_shared/auth";
import { searchTraces, type TraceKind, type TraceWindow } from "@/app/api/admin/traces/_shared";

const TRACE_KINDS = new Set<TraceKind>(["failure", "timeout", "slow", "all"]);
const TRACE_WINDOWS = new Set<TraceWindow>(["1h", "24h", "7d"]);

const readTraceKind = (value: string | null): TraceKind =>
  TRACE_KINDS.has(value as TraceKind) ? (value as TraceKind) : "failure";

const readTraceWindow = (value: string | null): TraceWindow =>
  TRACE_WINDOWS.has(value as TraceWindow) ? (value as TraceWindow) : "1h";

const readLimit = (value: string | null): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 50;
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
    const traces = await searchTraces({
      kind: readTraceKind(params.get("kind")),
      service: params.get("service")?.trim() || undefined,
      operation: params.get("operation")?.trim() || undefined,
      window: readTraceWindow(params.get("window")),
      limit: readLimit(params.get("limit")),
    });
    return NextResponse.json({ code: 200, msg: "success", data: { traces } });
  } catch (error) {
    return NextResponse.json(
      {
        code: 503,
        msg: error instanceof Error ? error.message : "Jaeger 服务暂时不可用",
        data: { traces: [] },
      },
      { status: 503 },
    );
  }
}
