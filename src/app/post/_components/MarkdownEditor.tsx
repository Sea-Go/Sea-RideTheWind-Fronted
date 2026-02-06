"use client";

import { Editor } from "@bytemd/react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <div className="h-full min-h-0">
      <Editor value={value} onChange={onChange} />
    </div>
  );
}
