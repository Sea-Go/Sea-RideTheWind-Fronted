import { NextRequest } from "next/server";

import { createProxyHandler, type ProxyRouteContext } from "@/app/api/_shared/proxy";

const TASK_CENTER_V1_PREFIX = "/taskcenter/v1";

const proxyRequest = createProxyHandler({
  envVarName: "TASK_CENTER_API_SERVER_URL",
  proxyName: "taskcenter-proxy",
  unavailableMessage: "Task service unavailable",
  resolveUpstreamPath: (path) => {
    if (path.length === 0) {
      return TASK_CENTER_V1_PREFIX;
    }
    return `${TASK_CENTER_V1_PREFIX}/${path.join("/")}`;
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
