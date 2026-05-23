import Link from "next/link";
import { cn } from "@/lib/cn";

type StatCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "critical" | "success";
  className?: string;
  href?: string;
};

export function StatCard({ title, value, hint, tone = "default", className, href }: StatCardProps) {
  const inner = (
    <>
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition"
        style={{ background: "color-mix(in srgb, var(--portal-accent) 18%, transparent)" }}
        aria-hidden
      />
      <p
        className="text-[0.65rem] font-bold uppercase tracking-[0.2em]"
        style={{ color: "var(--portal-stat-title)" }}
      >
        {title}
      </p>
      <p
        className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight"
        style={{ color: "var(--portal-stat-value)" }}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs" style={{ color: "var(--portal-stat-hint)" }}>
          {hint}
        </p>
      ) : null}
    </>
  );

  const shellClass = cn(
    "group lunar-stat",
    tone === "critical" && "[--portal-stat-value:var(--portal-badge-danger-text)]",
    tone === "success" && "[--portal-stat-value:var(--portal-badge-success-text)]",
    href && "cursor-pointer transition hover:ring-2 hover:ring-[var(--portal-accent)]/30",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={shellClass}>
        {inner}
      </Link>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}
