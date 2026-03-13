import { processDocument } from "./document-processor";
import { callDashScopeChatJson } from "./llm-service";
import type { StructuredSummary, SummaryGenerationResult } from "./types";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "have",
  "will",
  "article",
  "post",
  "about",
]);

const detectDomain = (text: string) => {
  const normalized = text.toLowerCase();
  if (/(ai|llm|model|prompt|machine learning|deep learning)/.test(normalized)) {
    return "AI";
  }
  if (/(frontend|react|next\.js|typescript|javascript|css|ui)/.test(normalized)) {
    return "前端开发";
  }
  if (/(backend|api|database|sql|redis|queue)/.test(normalized)) {
    return "后端工程";
  }
  return "综合技术";
};

const extractKeywords = (text: string) => {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item) => !STOP_WORDS.has(item));

  const frequency = new Map<string, number>();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item) => !STOP_WORDS.has(item));

const calculateGroundingScore = (summary: StructuredSummary, sourceText: string) => {
  const sourceTokens = new Set(tokenize(sourceText));
  const summaryText = [
    summary.title,
    summary.domain,
    summary.coreProblem,
    ...summary.keyContributions,
    ...summary.keywords,
  ].join(" ");
  const summaryTokens = tokenize(summaryText);

  if (!summaryTokens.length) {
    return 0;
  }

  const matchedCount = summaryTokens.filter((token) => sourceTokens.has(token)).length;
  return matchedCount / summaryTokens.length;
};

export const generateStructuredSummary = ({
  title,
  content,
}: {
  title?: string;
  content: string;
}): Promise<SummaryGenerationResult> => {
  const processed = processDocument(content);
  const normalizedText = processed.normalizedText;

  const fallbackSummary = () => {
    const resolvedTitle =
      typeof title === "string" && title.trim()
        ? title.trim()
        : normalizedText.slice(0, 20) || "未命名文章";

    const firstSentence = normalizedText.split(/[。.!?！？]/)[0]?.trim() || "";
    const secondSentence = normalizedText.split(/[。.!?！？]/)[1]?.trim() || "";

    const keywords = extractKeywords(normalizedText);

    return {
      title: resolvedTitle,
      domain: detectDomain(normalizedText),
      coreProblem: firstSentence || "围绕主题进行系统阐述",
      keyContributions: [firstSentence, secondSentence]
        .filter(Boolean)
        .slice(0, 3)
        .map((item) => item.slice(0, 80)),
      keywords,
      tone: "academic" as const,
    };
  };

  const clampTone = (tone: string | undefined): StructuredSummary["tone"] => {
    if (tone === "engineering") {
      return "engineering";
    }
    if (tone === "general") {
      return "general";
    }
    return "academic";
  };

  const sanitizeArray = (value: unknown, max: number) => {
    if (!Array.isArray(value)) {
      return [] as string[];
    }

    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, max);
  };

  if (!normalizedText) {
    return Promise.resolve({
      summary: fallbackSummary(),
      source: "fallback",
      groundingScore: 1,
    });
  }

  const systemPrompt =
    "你是一个中文摘要助手。你必须严格依据原文内容，不得添加原文没有的信息。请输出严格JSON。";
  const userPrompt = `请阅读下列文章内容，生成结构化摘要。\n\n输出JSON字段必须为：\n{\n  \"title\": string,\n  \"domain\": string,\n  \"coreProblem\": string,\n  \"keyContributions\": string[],\n  \"keywords\": string[],\n  \"tone\": \"academic\" | \"engineering\" | \"general\"\n}\n\n硬性要求：\n1) 所有字段必须来自原文，不可杜撰\n2) keyContributions 输出1-3条\n3) keywords 输出3-6条，优先使用原文关键词\n4) coreProblem 与 keyContributions 尽量贴近原文表达\n5) 仅输出JSON\n\n标题：${title?.trim() || "（无标题）"}\n正文：${normalizedText.slice(0, 6000)}`;

  return callDashScopeChatJson<Partial<StructuredSummary>>({
    systemPrompt,
    userPrompt,
  })
    .then((summary) => {
      const fallback = fallbackSummary();

      const llmSummary: StructuredSummary = {
        title:
          typeof summary.title === "string" && summary.title.trim()
            ? summary.title.trim()
            : fallback.title,
        domain:
          typeof summary.domain === "string" && summary.domain.trim()
            ? summary.domain.trim()
            : fallback.domain,
        coreProblem:
          typeof summary.coreProblem === "string" && summary.coreProblem.trim()
            ? summary.coreProblem.trim()
            : fallback.coreProblem,
        keyContributions: (() => {
          const values = sanitizeArray(summary.keyContributions, 3);
          return values.length ? values : fallback.keyContributions;
        })(),
        keywords: (() => {
          const values = sanitizeArray(summary.keywords, 6);
          return values.length ? values : fallback.keywords;
        })(),
        tone: clampTone(typeof summary.tone === "string" ? summary.tone : undefined),
      };

      return llmSummary;
    })
    .then((llmSummary) => {
      const fallback = fallbackSummary();
      const groundingScore = calculateGroundingScore(llmSummary, normalizedText);

      if (groundingScore < 0.35) {
        console.warn(
          `LLM summary grounding score too low (${groundingScore.toFixed(2)}), fallback to rule-based summary.`,
        );
        return {
          summary: fallback,
          source: "fallback" as const,
          groundingScore,
        };
      }

      return {
        summary: llmSummary,
        source: "llm" as const,
        groundingScore,
      };
    })
    .catch((error) => {
      console.error("LLM summary generation failed, fallback to rule-based summary:", error);
      return {
        summary: fallbackSummary(),
        source: "fallback" as const,
        groundingScore: 0,
      };
    });
};
