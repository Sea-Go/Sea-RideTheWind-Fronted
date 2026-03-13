const DASHSCOPE_CHAT_ENDPOINT =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DASHSCOPE_TEXT_MODEL = process.env.DASHSCOPE_TEXT_MODEL ?? "qwen-plus";
const CHAT_TIMEOUT_MS = 45000;

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const extractMessageContent = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const choices = "choices" in payload ? (payload.choices as unknown[]) : [];
  if (!Array.isArray(choices) || !choices.length) {
    return null;
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    return null;
  }

  const message =
    "message" in firstChoice ? (firstChoice.message as Record<string, unknown>) : null;
  const content = message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
};

const extractJSONObject = (rawText: string) => {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return rawText.slice(start, end + 1);
};

export const callDashScopeChatText = async ({
  systemPrompt,
  userPrompt,
}: {
  systemPrompt: string;
  userPrompt: string;
}) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const response = await fetchWithTimeout(
    DASHSCOPE_CHAT_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DASHSCOPE_TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.3,
      }),
      cache: "no-store",
    },
    CHAT_TIMEOUT_MS,
  );

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`DashScope chat failed: ${response.status} ${errorMessage.slice(0, 400)}`);
  }

  const data = (await response.json()) as unknown;
  const content = extractMessageContent(data);
  if (!content) {
    throw new Error("DashScope chat response has no valid content");
  }

  return content;
};

export const callDashScopeChatJson = async <T>({
  systemPrompt,
  userPrompt,
}: {
  systemPrompt: string;
  userPrompt: string;
}) => {
  const text = await callDashScopeChatText({
    systemPrompt,
    userPrompt,
  });

  const jsonText = extractJSONObject(text);
  if (!jsonText) {
    throw new Error("DashScope chat response has no JSON object");
  }

  return JSON.parse(jsonText) as T;
};
