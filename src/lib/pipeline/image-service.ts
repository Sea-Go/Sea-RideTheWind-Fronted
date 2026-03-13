const DASHSCOPE_IMAGE_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const DASHSCOPE_TASK_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/tasks";
const DASHSCOPE_IMAGE_MODEL = process.env.DASHSCOPE_IMAGE_MODEL ?? "qwen-image-plus";
const IMAGE_WIDTH = 960;
const IMAGE_HEIGHT = 1280;
const FETCH_TIMEOUT_MS = 30000;
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const TASK_POLL_INTERVAL_MS = 3000;
const TASK_POLL_TIMEOUT_MS = 180000;

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

const extractImageUrl = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const output = "output" in payload ? (payload.output as Record<string, unknown>) : undefined;
  const results = output?.results;
  if (!Array.isArray(results) || !results.length) {
    return null;
  }

  const first = results[0];
  if (!first || typeof first !== "object") {
    return null;
  }

  const url = "url" in first ? first.url : null;
  return typeof url === "string" && url.trim() ? url.trim() : null;
};

const extractTaskId = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const output = "output" in payload ? (payload.output as Record<string, unknown>) : undefined;
  const taskId = output?.task_id;
  return typeof taskId === "string" && taskId.trim() ? taskId.trim() : null;
};

const extractTaskStatus = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const output = "output" in payload ? (payload.output as Record<string, unknown>) : undefined;
  const taskStatus = output?.task_status;
  return typeof taskStatus === "string" && taskStatus.trim() ? taskStatus.trim() : null;
};

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTrustedImageUrl = (urlValue: string) => {
  try {
    const parsed = new URL(urlValue);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") {
      return false;
    }

    return hostname === "dashscope.aliyuncs.com" || hostname.endsWith(".aliyuncs.com");
  } catch {
    return false;
  }
};

export const generateImageBufferFromPrompt = async (prompt: string) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured");
  }

  const createTaskResponse = await fetchWithTimeout(
    DASHSCOPE_IMAGE_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: DASHSCOPE_IMAGE_MODEL,
        input: {
          prompt,
        },
        parameters: {
          size: `${IMAGE_WIDTH}*${IMAGE_HEIGHT}`,
          n: 1,
          watermark: false,
        },
      }),
      cache: "no-store",
    },
    FETCH_TIMEOUT_MS,
  );

  if (!createTaskResponse.ok) {
    const errorMessage = await createTaskResponse.text();
    throw new Error(
      `DashScope create task failed: ${createTaskResponse.status} ${errorMessage.slice(0, 300)}`,
    );
  }

  const createTaskData = (await createTaskResponse.json()) as unknown;
  const taskId = extractTaskId(createTaskData);

  if (!taskId) {
    throw new Error("DashScope response has no valid task_id");
  }

  const startedAt = Date.now();
  let taskResultData: unknown = null;

  while (Date.now() - startedAt < TASK_POLL_TIMEOUT_MS) {
    const taskResponse = await fetchWithTimeout(
      `${DASHSCOPE_TASK_ENDPOINT}/${taskId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      },
      FETCH_TIMEOUT_MS,
    );

    if (!taskResponse.ok) {
      const errorMessage = await taskResponse.text();
      throw new Error(
        `DashScope query task failed: ${taskResponse.status} ${errorMessage.slice(0, 300)}`,
      );
    }

    const taskData = (await taskResponse.json()) as unknown;
    const taskStatus = extractTaskStatus(taskData);

    if (taskStatus === "SUCCEEDED") {
      taskResultData = taskData;
      break;
    }

    if (taskStatus === "FAILED") {
      throw new Error(`DashScope task failed: ${JSON.stringify(taskData).slice(0, 400)}`);
    }

    await sleep(TASK_POLL_INTERVAL_MS);
  }

  if (!taskResultData) {
    throw new Error("DashScope task polling timeout");
  }

  const imageUrl = extractImageUrl(taskResultData);
  if (!imageUrl) {
    throw new Error("DashScope response has no valid image url");
  }

  if (!isTrustedImageUrl(imageUrl)) {
    throw new Error("DashScope image url is not trusted");
  }

  const imageResponse = await fetchWithTimeout(
    imageUrl,
    {
      cache: "no-store",
    },
    FETCH_TIMEOUT_MS,
  );

  if (!imageResponse.ok) {
    throw new Error(`Download generated image failed: ${imageResponse.status}`);
  }

  const contentLengthText = imageResponse.headers.get("content-length");
  const contentLength = contentLengthText ? Number(contentLengthText) : null;
  if (contentLength && Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Generated image is too large");
  }

  const imageContentType = imageResponse.headers.get("content-type") ?? "";
  if (!imageContentType.startsWith("image/")) {
    throw new Error(`Generated resource is not image: ${imageContentType}`);
  }

  const imageArrayBuffer = await imageResponse.arrayBuffer();
  if (imageArrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Generated image is too large");
  }

  return {
    contentType: imageContentType,
    buffer: Buffer.from(imageArrayBuffer),
  };
};
