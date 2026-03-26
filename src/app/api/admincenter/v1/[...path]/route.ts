import { NextRequest } from "next/server";

import { createProxyHandler, type ProxyRouteContext } from "@/app/api/_shared/proxy";

const ADMIN_CENTER_V1_PREFIX = "/admincenter/v1";

const proxyRequest = createProxyHandler({
  envVarName: "ADMIN_CENTER_API_SERVER_URL",
  proxyName: "admincenter-proxy",
  unavailableMessage: "管理服务暂时不可用",
  resolveUpstreamPath: (path) => {
    if (path.length === 0) {
      return ADMIN_CENTER_V1_PREFIX;
    }
    return `${ADMIN_CENTER_V1_PREFIX}/${path.join("/")}`;
  },
});

export async function GET(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: ProxyRouteContext): Promise<Response> {
  return proxyRequest(request, context);
}
