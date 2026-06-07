import type { ReactNode } from "react";

import "bytemd/dist/index.css";
import "@/components/article/bytemd-overrides.css";
import "@/components/travel-agent/travel-chat-markdown.css";

export default function DashboardTravelAgentLayout({ children }: { children: ReactNode }) {
  return children;
}
