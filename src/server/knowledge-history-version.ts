import routes from "@/features/knowledge/generated/routes-v2-history.json";

/** The generated RTW v2 contract contains only the three User JWT history GETs. */
const historyPaths = routes.map((route) => route.path.split("/"));
const matches = (path: string, pattern: string[]) => {
  const segments = path.split("/");
  return (
    pattern.length === segments.length &&
    pattern.every((part, i) =>
      /^\{[^}]+\}$/.test(part) ? Boolean(segments[i]) : part === segments[i],
    )
  );
};

export function isKnowledgeHistoryRead(path: string, method: string) {
  return method.toUpperCase() === "GET" && historyPaths.some((pattern) => matches(path, pattern));
}

export function knowledgeHistoryVersion(path: string, method: string): "v1" | "v2" | "invalid" {
  if (!isKnowledgeHistoryRead(path, method)) return "v1";
  const configured = process.env.SEA_KNOWLEDGE_HISTORY_READ_VERSION || "v1";
  if (configured === "v1" || configured === "v2") return configured;
  return "invalid";
}

export function hasAllowedHistoryQuery(path: string, searchParams: URLSearchParams) {
  const list = matches(path, historyPaths[0]);
  const allowed = list ? new Set(["limit", "after_ordinal"]) : new Set<string>();
  const seen = new Set<string>();
  for (const key of searchParams.keys()) {
    if (!allowed.has(key) || seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}
