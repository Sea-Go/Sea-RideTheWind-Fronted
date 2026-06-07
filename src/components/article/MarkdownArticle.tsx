"use client";

import dynamic from "next/dynamic";

const ByteMDViewer = dynamic(
  () => import("@/components/article/ByteMDViewer").then((module) => module.ByteMDViewer),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground">正文加载中...</p>,
  },
);

interface MarkdownArticleProps {
  value: string;
  emptyText?: string;
  className?: string;
}

export const MarkdownArticle = ({
  value,
  emptyText = "暂无正文",
  className,
}: MarkdownArticleProps) => {
  const normalizedValue = normalizeMarkdownTables(value).trim();

  if (!normalizedValue) {
    return <p className="text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className={["article-markdown", className].filter(Boolean).join(" ")}>
      <ByteMDViewer value={normalizedValue} />
    </div>
  );
};

const normalizeMarkdownTables = (value: string) => {
  const lines = value.split(/\r?\n/);
  const output: string[] = [];
  let isInFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmedLine = line.trim();

    if (/^(```|~~~)/.test(trimmedLine)) {
      isInFence = !isInFence;
      output.push(line);
      continue;
    }

    const nextLine = lines[index + 1] ?? "";
    if (!isInFence && looksLikeTableHeader(line, nextLine)) {
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && looksLikeTableRow(lines[index] ?? "")) {
        rows.push(splitTableRow(lines[index] ?? ""));
        index += 1;
      }

      index -= 1;
      output.push(renderHtmlTable(headers, rows));
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
};

const looksLikeTableHeader = (line: string, nextLine: string) => {
  const headers = splitTableRow(line);
  const separators = splitTableRow(nextLine);

  return (
    headers.length > 1 &&
    separators.length === headers.length &&
    separators.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  );
};

const looksLikeTableRow = (line: string) => {
  const cells = splitTableRow(line);
  return cells.length > 1 && line.includes("|") && line.trim().length > 0;
};

const splitTableRow = (line: string) => {
  const trimmedLine = line.trim();
  const content =
    trimmedLine.startsWith("|") && trimmedLine.endsWith("|")
      ? trimmedLine.slice(1, -1)
      : trimmedLine;
  const cells: string[] = [];
  let currentCell = "";
  let isEscaped = false;

  for (const char of content) {
    if (isEscaped) {
      currentCell += char;
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      currentCell += char;
      continue;
    }

    if (char === "|") {
      cells.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  cells.push(currentCell.trim());
  return cells;
};

const renderHtmlTable = (headers: string[], rows: string[][]) => {
  const normalizedRows = rows.map((row) => headers.map((_, index) => escapeHtml(row[index] ?? "")));
  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const rowHtml = normalizedRows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");

  return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowHtml}</tbody></table>`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
