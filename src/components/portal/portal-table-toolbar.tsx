import Link from "next/link";
import { buildPortalTableHref, type PortalTableParams } from "@/lib/portal-table";
import { cn } from "@/lib/cn";

export type PortalTableFilterField =
  | {
      type: "search";
      name?: string;
      label?: string;
      placeholder: string;
      defaultValue?: string;
    }
  | {
      type: "select";
      name: string;
      label: string;
      defaultValue?: string;
      options: Array<{ value: string; label: string }>;
    };

type PortalTableToolbarProps = {
  basePath: string;
  fields: PortalTableFilterField[];
  /** Preserved in Apply (sort, dir, page, tab, runId, etc.) */
  preserved?: PortalTableParams & Record<string, string | undefined>;
  /** Reset target (defaults to basePath with no query). */
  resetHref?: string;
  className?: string;
  layout?: "default" | "search-only";
};

export function PortalTableToolbar({
  basePath,
  fields,
  preserved = {},
  resetHref,
  className,
  layout = "default",
}: PortalTableToolbarProps) {
  const resetLink =
    resetHref ??
    buildPortalTableHref(basePath, {
      tab: preserved.tab,
      runId: preserved.runId,
      siteId: preserved.siteId,
    });
  const hiddenSort = preserved.sort;
  const hiddenDir = preserved.dir;

  return (
    <form
      method="get"
      action={basePath}
      className={cn(
        "portal-filter-bar",
        layout === "search-only" && "portal-filter-bar--search",
        fields.length <= 2 && layout === "default" && "portal-filter-bar--3",
        className,
      )}
    >
      {fields.map((field) => {
        if (field.type === "search") {
          const name = field.name ?? "q";
          return (
            <label key={name} className="flex min-w-0 flex-col gap-1.5 text-sm text-[var(--portal-text-muted)]">
              {field.label ?? "Search"}
              <input
                name={name}
                type="search"
                defaultValue={field.defaultValue ?? ""}
                placeholder={field.placeholder}
                className="w-full lunar-input"
              />
            </label>
          );
        }
        return (
          <label key={field.name} className="flex min-w-0 flex-col gap-1.5 text-sm text-[var(--portal-text-muted)]">
            {field.label}
            <select name={field.name} defaultValue={field.defaultValue ?? ""} className="w-full lunar-select">
              {field.options.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <div className="flex flex-wrap items-end gap-2.5 pb-0.5">
        {hiddenSort ? <input type="hidden" name="sort" value={hiddenSort} /> : null}
        {hiddenDir ? <input type="hidden" name="dir" value={hiddenDir} /> : null}
        {preserved.tab ? <input type="hidden" name="tab" value={preserved.tab} /> : null}
        {preserved.runId ? <input type="hidden" name="runId" value={preserved.runId} /> : null}
        <button type="submit" className="lunar-btn-primary">
          Apply
        </button>
        <Link href={resetLink} className="lunar-btn-secondary">
          Reset
        </Link>
      </div>
    </form>
  );
}

/** Compact search-only bar (no Apply button — submits on Enter). */
export function PortalTableSearchBar({
  basePath,
  placeholder,
  defaultValue = "",
  preserved = {},
  className,
}: {
  basePath: string;
  placeholder: string;
  defaultValue?: string;
  preserved?: PortalTableParams & Record<string, string | undefined>;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={basePath}
      className={cn("portal-filter-bar portal-filter-bar--search", className)}
    >
      <input
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-w-0 w-full lunar-input"
      />
      {preserved.sort ? <input type="hidden" name="sort" value={preserved.sort} /> : null}
      {preserved.dir ? <input type="hidden" name="dir" value={preserved.dir} /> : null}
      {preserved.status ? <input type="hidden" name="status" value={preserved.status} /> : null}
      {preserved.siteId ? <input type="hidden" name="siteId" value={preserved.siteId} /> : null}
      {preserved.role ? <input type="hidden" name="role" value={preserved.role} /> : null}
      {preserved.tab ? <input type="hidden" name="tab" value={preserved.tab} /> : null}
    </form>
  );
}

export function buildTablePreservedQuery(params: PortalTableParams & Record<string, string | undefined>) {
  return buildPortalTableHref("", params).replace(/^\?/, "");
}
