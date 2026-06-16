import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AdminPageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-[112rem] space-y-4", className)}>{children}</div>;
}

export function AdminPanel({
  actions,
  children,
  className,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {title || actions ? (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0 text-sm font-semibold text-slate-900">{title}</div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type AdminKpiTone = "blue" | "green" | "red" | "amber" | "slate";

const toneClassName: Record<AdminKpiTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-600",
  blue: "border-sky-200 bg-sky-50 text-sky-600",
  green: "border-emerald-200 bg-emerald-50 text-emerald-600",
  red: "border-rose-200 bg-rose-50 text-rose-600",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
};

export function AdminKpiCard({
  icon: Icon,
  label,
  meta,
  tone = "slate",
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  meta?: string;
  tone?: AdminKpiTone;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md border",
            toneClassName[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      {meta ? <p className="mt-3 truncate text-xs text-slate-500">{meta}</p> : null}
    </div>
  );
}
