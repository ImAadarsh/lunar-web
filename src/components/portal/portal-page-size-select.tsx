"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildPortalTableHref,
  PORTAL_PAGE_SIZE_OPTIONS,
  type PortalPageSize,
  type PortalTableParams,
} from "@/lib/portal-table";

type PortalPageSizeSelectProps = {
  /** Current page size (already validated). */
  pageSize: number;
  /**
   * Server-table mode: navigate via `basePath` + preserved query (resets `page` to 1).
   * When omitted, updates the current URL's `pageSize` query param in place.
   */
  basePath?: string;
  query?: PortalTableParams & Record<string, string | number | undefined>;
  /** Called after page size changes (client tables use this to reset local page state). */
  onPageSizeChange?: (pageSize: PortalPageSize) => void;
  className?: string;
};

export function PortalPageSizeSelect({
  pageSize,
  basePath,
  query,
  onPageSizeChange,
  className,
}: PortalPageSizeSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextRaw: string) {
    const next = Number(nextRaw) as PortalPageSize;
    if (!PORTAL_PAGE_SIZE_OPTIONS.includes(next)) return;

    onPageSizeChange?.(next);

    if (basePath) {
      router.push(
        buildPortalTableHref(basePath, {
          ...query,
          pageSize: next,
          page: 1,
        }),
      );
      return;
    }

    const sp = new URLSearchParams(searchParams.toString());
    sp.set("pageSize", String(next));
    sp.delete("page");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className={className ?? "inline-flex items-center gap-2 text-sm text-[var(--portal-text-muted)]"}>
      <span className="whitespace-nowrap">Rows</span>
      <select
        value={pageSize}
        onChange={(e) => handleChange(e.target.value)}
        className="lunar-select lunar-input-sm w-auto min-w-[4.5rem]"
        aria-label="Rows per page"
      >
        {PORTAL_PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
