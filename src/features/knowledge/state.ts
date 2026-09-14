import type { RetrievalProfile, Revision } from "./api";

export const statusNames: Record<string, string> = {
  NOT_BUILT: "尚未构建",
  ACCEPTED: "编制已接纳",
  PENDING: "等待执行",
  BUILDING: "正在构建",
  COMPILING: "正在编制",
  RUNNING: "正在执行",
  READY: "构建就绪",
  COMPLETED: "编制完成",
  SUCCEEDED: "编制完成",
  FAILED: "执行失败",
  CANCELLED: "已取消",
  SUPERSEDED: "已被新任务替代",
};
export const statusName = (value: string) => statusNames[value] || `未知状态：${value || "未提供"}`;
export const isPending = (value: string) =>
  ["PENDING", "BUILDING", "COMPILING", "RUNNING"].includes(value);
export function latestRevisions(items: Revision[], kind: string) {
  const heads = new Map<string, Revision>();
  for (const revision of items.filter((r) => r.kind === kind && !r.withdrawn)) {
    const previous = heads.get(revision.entity_id);
    if (!previous || revision.created_at > previous.created_at)
      heads.set(revision.entity_id, revision);
  }
  return [...heads.values()];
}
export function parseProfiles(text: string): RetrievalProfile[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value) || value.length !== 3)
    throw new Error("请填写搜索负责人提供的 Dense、Sparse、Multi-vector 三路配置。");
  const lanes = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") throw new Error("每一路配置必须是对象。");
    const row = entry as Record<string, unknown>;
    if (
      !["dense", "sparse", "multivector"].includes(String(row.lane)) ||
      lanes.has(String(row.lane))
    )
      throw new Error("三路 lane 必须分别是 dense、sparse、multivector。");
    if (
      [row.encoder, row.tokenizer, row.space].some((v) => typeof v !== "string" || !v.trim()) ||
      !Number.isSafeInteger(row.dimensions) ||
      Number(row.dimensions) < 1
    )
      throw new Error("编码器、分词器、空间和正整数维度必须完整填写。");
    if (
      row.lane === "multivector" &&
      [row.mask, row.aggregation].some((v) => typeof v !== "string" || !v.trim())
    )
      throw new Error("Multi-vector 还需要 mask 和 aggregation。");
    if (
      row.lane === "multivector" &&
      !["maxsim", "sum_maxsim", "mean_maxsim"].includes(String(row.aggregation))
    )
      throw new Error("Multi-vector 需指定 sum_maxsim 或 mean_maxsim；maxsim 仅保留旧结构配置。");
    if (row.lane !== "multivector" && (row.mask || row.aggregation))
      throw new Error("mask 和 aggregation 仅属于 Multi-vector。");
    lanes.add(String(row.lane));
  }
  return value as RetrievalProfile[];
}
/** Same in-flight command keeps its key on a transport failure; edited input is a new intent. */
export class CommandKeys {
  private keys = new Map<string, string>();
  key(scope: string, data: unknown) {
    const signature = JSON.stringify([scope, data]);
    let key = this.keys.get(signature);
    if (!key) {
      key = crypto.randomUUID();
      this.keys.set(signature, key);
    }
    return key;
  }
  complete(scope: string, data: unknown) {
    this.keys.delete(JSON.stringify([scope, data]));
  }
}

export function revisionHref(
  moduleId: string,
  releaseId: string,
  revision: Pick<Revision, "revision_id" | "kind">,
  locator = "",
) {
  const q = new URLSearchParams({ release: releaseId, revision: revision.revision_id });
  if (locator) q.set("locator", locator);
  return `/knowledge/${encodeURIComponent(moduleId)}/${revision.kind === "source" ? "sources" : "read"}?${q}${locator ? "#source-location" : ""}`;
}
export function sourceParagraph(content: string, locator: string): string | null {
  const match = /^paragraph:([1-9]\d*)$/.exec(locator);
  if (!match) return null;
  return (
    content
      .replace(/\r\n/g, "\n")
      .trim()
      .split("\n\n")
      .filter((p) => p.trim())[Number(match[1]) - 1] ?? null
  );
}
