"use client";

import { XIcon } from "lucide-react";
import { KeyboardEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const MAX_SECONDARY_TAGS = 10;
export const MAX_SECONDARY_TAG_LENGTH = 8;

interface SecondaryTagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

const normalizeTag = (value: string): string => value.trim().replace(/\s+/g, "");

export default function SecondaryTagsInput({
  tags,
  onChange,
  disabled = false,
}: SecondaryTagsInputProps) {
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const remaining = useMemo(() => MAX_SECONDARY_TAGS - tags.length, [tags.length]);

  const commitDraft = () => {
    const nextTag = normalizeTag(draft);
    if (!nextTag) {
      setDraft("");
      return;
    }

    if (nextTag.length > MAX_SECONDARY_TAG_LENGTH) {
      setMessage(`单个标签最多 ${MAX_SECONDARY_TAG_LENGTH} 个字`);
      return;
    }
    if (tags.includes(nextTag)) {
      setMessage("这个标签已经添加过了");
      return;
    }
    if (tags.length >= MAX_SECONDARY_TAGS) {
      setMessage(`一篇文章最多添加 ${MAX_SECONDARY_TAGS} 个标签`);
      return;
    }

    onChange([...tags, nextTag]);
    setDraft("");
    setMessage(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
      setMessage(null);
    }
  };

  const handleRemove = (tag: string) => {
    onChange(tags.filter((item) => item !== tag));
    setMessage(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="post-secondary-tags">文章标签</Label>
        <span className="text-muted-foreground text-xs">还可添加 {Math.max(remaining, 0)} 个</span>
      </div>

      <Input
        id="post-secondary-tags"
        type="text"
        value={draft}
        placeholder="输入标签后按回车，例如：旅行攻略"
        onChange={(event) => {
          setDraft(event.target.value);
          if (message) {
            setMessage(null);
          }
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        maxLength={MAX_SECONDARY_TAG_LENGTH}
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
            >
              {tag}
              <button
                type="button"
                aria-label={`删除标签 ${tag}`}
                onClick={() => handleRemove(tag)}
                disabled={disabled}
                className="hover:text-primary/70"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={commitDraft} disabled={disabled || !draft.trim()}>
          添加标签
        </Button>
        <p className="text-muted-foreground text-xs">
          单个标签最多 {MAX_SECONDARY_TAG_LENGTH} 个字，一篇文章最多 {MAX_SECONDARY_TAGS} 个标签。
        </p>
      </div>

      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
