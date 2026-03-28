import { redirect } from "next/navigation";

import { buildLoginPath } from "@/lib/auth-entry";

interface AdminRegisterPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function AdminRegisterPage({ searchParams }: AdminRegisterPageProps) {
  const { next } = await searchParams;
  const nextValue = Array.isArray(next) ? next[0] : next;
  redirect(buildLoginPath({ role: "admin", mode: "register", next: nextValue }));
}
