import routes from "@/features/knowledge/generated/routes.json";

/** Product routes are generated from RTW's API DSL; worker routes never enter this table. */
export function isKnowledgeRoute(path: string, method: string) {
  const segments = path.split("/");
  return routes.some((route) => {
    if (route.method !== method.toUpperCase()) return false;
    const pattern = route.path.split("/");
    return (
      pattern.length === segments.length &&
      pattern.every((part, i) =>
        /^\{[^}]+\}$/.test(part) ? Boolean(segments[i]) : part === segments[i],
      )
    );
  });
}

/** These RTW product reads and writes use the administrator session. */
export function isKnowledgeWikiReviewRoute(path: string) {
  return /^knowledge\/modules\/[^/]+\/wiki-pages\/[^/]+\/(?:head|revisions\/[^/]+\/quality-judgments(?:\/[^/]+)?)$/.test(
    path,
  );
}
