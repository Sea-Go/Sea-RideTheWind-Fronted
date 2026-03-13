import { processDocument } from "./document-processor";
import { callDashScopeChatJson } from "./llm-service";
import { type PromptGenerationResult, type StructuredSummary } from "./types";

const sanitizeArray = (value: unknown, max: number) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsPhrase = (sourceText: string, phrase: string) => {
  if (!phrase.trim()) {
    return false;
  }

  const pattern = new RegExp(escapeRegExp(phrase.trim()), "i");
  return pattern.test(sourceText);
};

export const buildCoverPromptFromSummary = async ({
  summary,
  title,
  content,
}: {
  summary: StructuredSummary;
  title?: string;
  content: string;
}): Promise<PromptGenerationResult> => {
  const normalizedText = processDocument(content).normalizedText;
  const keywords = summary.keywords.join(", ");
  const contributions = summary.keyContributions.join("; ");
  const titleContext = typeof title === "string" && title.trim() ? title.trim() : summary.title;
  const fallbackPrompt = `Create a text-free, no-watermark, no-logo article cover in 3:4 ratio, based strictly on this source: title "${titleContext}", core scene "${summary.coreProblem}", contributions "${contributions}", and keywords "${keywords}". Keep the composition concrete and visually tied to the source events, with cinematic illustration style and clear narrative elements.`;

  const systemPrompt =
    "You are an expert prompt engineer. Output strict JSON only, and every visual element must be grounded in the provided source text.";
  const userPrompt = `Generate a text-to-image prompt for an article cover.\n\nReturn JSON only in this shape:\n{\n  \"prompt\": string,\n  \"grounding\": string[]\n}\n\nHard constraints:\n1) prompt must be in English and one sentence.\n2) No text, no watermark, no logo.\n3) Aspect ratio 3:4.\n4) grounding must list 2-4 short phrases copied from source text (exact or near-exact).\n5) Visual content must stay faithful to source text, no invented setting.\n\nSource title: ${titleContext}\nSource content: ${normalizedText.slice(0, 6000)}\n\nSummary:\n- domain: ${summary.domain}\n- coreProblem: ${summary.coreProblem}\n- keyContributions: ${contributions}\n- keywords: ${keywords}`;

  try {
    const generated = await callDashScopeChatJson<{
      prompt?: unknown;
      grounding?: unknown;
    }>({
      systemPrompt,
      userPrompt,
    });

    const prompt = typeof generated.prompt === "string" ? generated.prompt.trim() : "";
    const groundingPhrases = sanitizeArray(generated.grounding, 4);
    const matchedGroundingCount = groundingPhrases.filter((item) =>
      containsPhrase(normalizedText, item),
    ).length;

    if (prompt && matchedGroundingCount >= 2) {
      return {
        prompt,
        source: "llm",
        groundingMatchedCount: matchedGroundingCount,
      };
    }

    console.warn(
      `LLM prompt grounding validation failed (matched grounding: ${matchedGroundingCount}), fallback to template prompt.`,
    );

    return {
      prompt: fallbackPrompt,
      source: "fallback",
      groundingMatchedCount: matchedGroundingCount,
    };
  } catch (error) {
    console.error("LLM prompt generation failed, fallback to template prompt:", error);
    return {
      prompt: fallbackPrompt,
      source: "fallback",
      groundingMatchedCount: 0,
    };
  }
};
