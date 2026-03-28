import { redirect } from "next/navigation";

import { buildLoginPath } from "@/lib/auth-entry";

interface AdminLoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const { next } = await searchParams;
  const nextValue = Array.isArray(next) ? next[0] : next;
  redirect(buildLoginPath({ role: "admin", mode: "login", next: nextValue }));
}
