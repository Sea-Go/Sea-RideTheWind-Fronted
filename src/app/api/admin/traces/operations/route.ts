import { NextRequest, NextResponse } from "next/server";

import {
  getBearerToken,
  unauthorizedAdminResponse,
  validateAdminToken,
} from "@/app/api/admin/_shared/auth";
import { fetchTraceOperations } from "@/app/api/admin/traces/_shared";

export async function GET(request: NextRequest): Promise<Response> {
  const authorized = await validateAdminToken(getBearerToken(request));
  if (!authorized) {
    return unauthorizedAdminResponse();
  }

  const service = request.nextUrl.searchParams.get("service")?.trim() ?? "";
  if (!service) {
    return NextResponse.json({ code: 200, msg: "success", data: { operations: [] } });
  }

  try {
    const operations = await fetchTraceOperations(service);
    return NextResponse.json({ code: 200, msg: "success", data: { operations } });
  } catch (error) {
    return NextResponse.json(
      {
        code: 503,
        msg: error instanceof Error ? error.message : "Jaeger 服务暂时不可用",
        data: { operations: [] },
      },
      { status: 503 },
    );
  }
}
