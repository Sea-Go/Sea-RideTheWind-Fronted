import type { ReactNode } from "react";

import "bytemd/dist/index.css";
import "@/components/article/bytemd-overrides.css";

export default function PostLayout({ children }: { children: ReactNode }) {
  return children;
}
