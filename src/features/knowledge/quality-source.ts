/** RTW's paragraph locator normalizes CRLF only to locate blank-line blocks.
 * The quote submitted for a human judgment must still be taken from the
 * original revision bytes, including its original line endings and spaces.
 */
export function originalSourceParagraph(content: string, locator: string): string | null {
  const match = /^paragraph:([1-9]\d*)$/.exec(locator);
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
  return content.split(/\r?\n\r?\n/).filter((block) => block.trim())[Number(match[1]) - 1] ?? null;
}

export async function sha256Utf8(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
