"use client";

import { Editor } from "@bytemd/react";

interface ByteMDEditorProps {
  value: string;
  onChange: (value: string) => void;
  uploadImages: (files: File[]) => Promise<Array<{ url: string; alt: string; title: string }>>;
}

export const ByteMDEditor = ({ value, onChange, uploadImages }: ByteMDEditorProps) => (
  <Editor value={value} onChange={onChange} uploadImages={uploadImages} />
);
