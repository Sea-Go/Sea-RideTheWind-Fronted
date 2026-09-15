/** Parse an accepted product response without losing duplicate object keys. */
export function parseStrictJSON(raw: string): unknown {
  if (raw.length > 8 * 1024 * 1024) throw new Error("历史响应过大。");
  const parsed = JSON.parse(raw) as unknown;
  let offset = 0;
  let nodes = 0;
  const whitespace = () => {
    while (offset < raw.length && /\s/.test(raw[offset])) offset++;
  };
  const quoted = (): string => {
    const begin = offset++;
    while (offset < raw.length) {
      if (raw[offset] === "\\") offset += 2;
      else if (raw[offset++] === '"') return JSON.parse(raw.slice(begin, offset)) as string;
    }
    throw new Error("历史 JSON 字符串未结束。");
  };
  const value = (depth: number): void => {
    if (++nodes > 100000 || depth > 64) throw new Error("历史 JSON 结构过深。");
    whitespace();
    if (raw[offset] === "{") {
      offset++;
      whitespace();
      const keys = new Set<string>();
      while (raw[offset] !== "}") {
        const key = quoted();
        if (keys.has(key)) throw new Error("历史 JSON 包含重复字段。");
        keys.add(key);
        whitespace();
        offset++;
        value(depth + 1);
        whitespace();
        if (raw[offset] === ",") {
          offset++;
          whitespace();
        } else break;
      }
      offset++;
    } else if (raw[offset] === "[") {
      offset++;
      whitespace();
      while (raw[offset] !== "]") {
        value(depth + 1);
        whitespace();
        if (raw[offset] === ",") {
          offset++;
          whitespace();
        } else break;
      }
      offset++;
    } else if (raw[offset] === '"') {
      quoted();
    } else {
      while (offset < raw.length && !/[\s,}\]]/.test(raw[offset])) offset++;
    }
  };
  value(0);
  whitespace();
  if (offset !== raw.length) throw new Error("历史 JSON 存在尾随内容。");
  return parsed;
}
