import { extractUploadError, extractUploadUrl } from "@/lib/upload-response";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ARTICLE_UPLOAD_UPSTREAM_PATH = "/v1/upload";

const buildMultipartRequestBody = ({
  buffer,
  contentType,
  fileName,
}: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}) => {
  const boundary = `----SeaCoverBoundary${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="${fileName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([head, buffer, tail]);

  return {
    body,
    contentLength: body.byteLength,
    contentTypeHeader: `multipart/form-data; boundary=${boundary}`,
  };
};

const detectExtension = (contentType: string) => {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("jpeg")) {
    return "jpg";
  }
  if (normalized.includes("png")) {
    return "png";
  }
  return "png";
};

export const uploadCoverImageToServer = async ({
  articleServerUrl,
  authorization,
  buffer,
  contentType,
}: {
  articleServerUrl: string;
  authorization: string;
  buffer: Buffer;
  contentType: string;
}) => {
  if (!authorization.trim()) {
    throw new Error("Missing authorization for cover upload");
  }
  if (buffer.byteLength === 0) {
    throw new Error("Generated image buffer is empty");
  }
  if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Generated image is too large");
  }

  const extension = detectExtension(contentType);
  const fileName = `cover-ai-${Date.now()}.${extension}`;
  const normalizedType = contentType.split(";")[0]?.trim() || "image/png";
  const multipart = buildMultipartRequestBody({
    buffer,
    contentType: normalizedType,
    fileName,
  });

  const response = await fetch(`${articleServerUrl}${ARTICLE_UPLOAD_UPSTREAM_PATH}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": multipart.contentTypeHeader,
      "Content-Length": String(multipart.contentLength),
    },
    body: multipart.body,
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch (error) {
    void error;
  }

  if (!response.ok) {
    throw new Error(extractUploadError(payload) ?? "封面上传失败，请重试");
  }

  const uploadedUrl = extractUploadUrl(payload);
  if (!uploadedUrl) {
    throw new Error("封面上传成功，但未返回有效地址");
  }

  return uploadedUrl;
};
