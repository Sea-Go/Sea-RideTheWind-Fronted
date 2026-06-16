import { NextRequest, NextResponse } from "next/server";

import {
  getBearerToken,
  unauthorizedAdminResponse,
  validateAdminToken,
} from "@/app/api/admin/_shared/auth";
import { fetchTraceServices } from "@/app/api/admin/traces/_shared";

export async function GET(request: NextRequest): Promise<Response> {
  const authorized = await validateAdminToken(getBearerToken(request));
  if (!authorized) {
    return unauthorizedAdminResponse();
  }

  try {
    const services = await fetchTraceServices();
    return NextResponse.json({ code: 200, msg: "success", data: { services } });
  } catch (error) {
    return NextResponse.json(
      {
        code: 503,
        msg: error instanceof Error ? error.message : "Jaeger 服务暂时不可用",
        data: { services: [] },
      },
      { status: 503 },
    );
  }
}
