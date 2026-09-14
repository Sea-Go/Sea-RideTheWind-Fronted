import type {
  AcceptedAnswer,
  AcceptedAnswersPage,
  ProductAnswerCitationStates,
} from "./generated/knowledgeComponents";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectValue)
    : null;
const string = (value: unknown) => (typeof value === "string" ? value : "");

export interface HistoricalCitation {
  id: string;
  quote: string;
  location: string;
  sourceHref: string;
  sourceKind: string;
  contentId: string;
  revisionId: string;
  quoteHash: string;
  originalKey: string;
  originalSha256: string;
}
export interface HistoricalAnswer {
  answerId: string;
  searchId: string;
  moduleId: string;
  releaseId: string;
  publicationRevision: string;
  ordinal: number;
  acceptedAt: string;
  question: string;
  answer: string;
  status: "succeeded" | "insufficient";
  citations: HistoricalCitation[];
}

/** Decode only the validated product turn fields used by the reading surface. */
export function readHistoricalAnswer(item: AcceptedAnswer, sessionId: string): HistoricalAnswer {
  if (item.session_id !== sessionId || !Number.isSafeInteger(item.accepted_ordinal))
    throw new Error("服务返回的历史记录与当前会话不一致。");
  let raw: unknown;
  try {
    raw = JSON.parse(item.turn_json);
  } catch {
    throw new Error("服务返回的历史答案无法解析。");
  }
  const turn = object(raw);
  const request = object(turn?.request);
  const result = object(turn?.result);
  const subject = object(request?.Subject);
  const acceptedSubject = object(item.subject);
  const searchRequest = object(request?.Search);
  const search = object(result?.search);
  const pack = object(search?.evidence_pack);
  const snapshot = object(pack?.snapshot);
  const status = string(result?.summary_status);
  const question = string(searchRequest?.Query);
  if (
    !request ||
    !result ||
    string(request.SessionID) !== sessionId ||
    string(request.AnswerID) !== item.answer_id ||
    string(request.SearchID) !== item.search_id ||
    !string(acceptedSubject?.authority_id) ||
    !string(acceptedSubject?.tenant_id) ||
    !string(acceptedSubject?.subject_id) ||
    string(subject?.authority_id) !== string(acceptedSubject?.authority_id) ||
    string(subject?.tenant_id) !== string(acceptedSubject?.tenant_id) ||
    string(subject?.subject_id) !== string(acceptedSubject?.subject_id) ||
    string(result.answer_id) !== item.answer_id ||
    string(pack?.search_id) !== item.search_id ||
    status !== item.status ||
    !["succeeded", "insufficient"].includes(status) ||
    !question.trim() ||
    !Array.isArray(result.citations) ||
    !Array.isArray(pack?.evidence)
  )
    throw new Error("服务返回的历史答案与已接受记录不一致。");

  const answer = string(result.answer);
  if (status === "succeeded" && (!answer.trim() || result.citations.length === 0))
    throw new Error("已完成答案缺少正文或引用。");
  if (new Set(result.citations).size !== result.citations.length)
    throw new Error("历史答案包含重复引用。");
  if (status === "insufficient" && (answer || result.citations.length))
    throw new Error("证据不足记录不应包含答案或引用。");

  const evidence = new Map<string, ObjectValue>();
  for (const row of pack.evidence) {
    const entry = object(row);
    const id = string(entry?.evidence_id);
    if (entry && id) evidence.set(id, entry);
  }
  const citations = result.citations.map((value) => {
    const id = string(value);
    const row = evidence.get(id);
    if (!id || !row) throw new Error("历史答案引用未包含在已接受证据中。");
    const key = object(row.key);
    const locator = object(row.locator);
    const original = object(row.original);
    const moduleId = string(snapshot?.module_id);
    const releaseId = string(snapshot?.release_id);
    const revisionId = string(key?.revision_id);
    const contentId = string(key?.content_id);
    const kind = string(key?.source_kind);
    const location = string(locator?.locator);
    const quoteHash = string(row.quote_hash);
    const originalKey = string(original?.key);
    const originalSha256 = string(original?.sha256);
    if (
      !moduleId ||
      !releaseId ||
      !string(snapshot?.publication_revision) ||
      !contentId ||
      !revisionId ||
      !kind ||
      !location ||
      !quoteHash ||
      !originalKey ||
      !originalSha256
    )
      throw new Error("历史引用缺少固定来源身份。");
    const sourceHref =
      moduleId && releaseId && revisionId && ["source", "wiki"].includes(kind)
        ? `/knowledge/${encodeURIComponent(moduleId)}/${kind === "source" ? "sources" : "read"}?${new URLSearchParams({ release: releaseId, revision: revisionId, ...(location ? { locator: location } : {}) })}`
        : "";
    return {
      id,
      quote: string(row.quote),
      location,
      sourceHref,
      sourceKind: kind,
      contentId,
      revisionId,
      quoteHash,
      originalKey,
      originalSha256,
    };
  });
  return {
    answerId: item.answer_id,
    searchId: item.search_id,
    moduleId: string(snapshot?.module_id),
    releaseId: string(snapshot?.release_id),
    publicationRevision: string(snapshot?.publication_revision),
    ordinal: item.accepted_ordinal,
    acceptedAt: item.accepted_at,
    question,
    answer,
    status: status as HistoricalAnswer["status"],
    citations,
  };
}

export function readCurrentCitationStates(
  answer: HistoricalAnswer,
  current: ProductAnswerCitationStates,
): Map<string, "available" | "unavailable"> {
  if (
    current.answer_id !== answer.answerId ||
    current.search_id !== answer.searchId ||
    current.status !== answer.status ||
    (answer.citations.length > 0 &&
      (current.module_id !== answer.moduleId ||
        current.release_id !== answer.releaseId ||
        current.publication_revision !== answer.publicationRevision)) ||
    current.citations.length !== answer.citations.length ||
    new Set(current.citations.map((row) => row.evidence_id)).size !== answer.citations.length
  )
    throw new Error("引用状态与当前历史答案不一致。");
  const states = new Map<string, "available" | "unavailable">();
  for (const [index, row] of current.citations.entries()) {
    if (
      row.evidence_id !== answer.citations[index].id ||
      row.source_kind !== answer.citations[index].sourceKind ||
      row.content_id !== answer.citations[index].contentId ||
      row.revision_id !== answer.citations[index].revisionId ||
      row.quote_hash !== answer.citations[index].quoteHash ||
      row.original?.key !== answer.citations[index].originalKey ||
      row.original?.sha256 !== answer.citations[index].originalSha256 ||
      row.locator?.locator !== answer.citations[index].location ||
      (row.state !== "available" && row.state !== "unavailable")
    )
      throw new Error("引用状态与当前历史答案不一致。");
    states.set(row.evidence_id, row.state);
  }
  return states;
}

export function appendAcceptedPage(
  previous: AcceptedAnswer[],
  page: AcceptedAnswersPage,
): AcceptedAnswer[] {
  const byID = new Map(previous.map((item) => [item.answer_id, item]));
  for (const item of page.items) byID.set(item.answer_id, item);
  return [...byID.values()].sort((a, b) => a.accepted_ordinal - b.accepted_ordinal);
}
