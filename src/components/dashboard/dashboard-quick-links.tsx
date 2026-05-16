import Link from "next/link";

type QuickLink = { href: string; label: string };

export function DashboardQuickLinks({ links }: { links: QuickLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-lunar-300 hover:text-lunar-800"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
