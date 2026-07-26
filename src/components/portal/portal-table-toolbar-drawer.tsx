import { FilterDrawer } from "@/components/portal/filter-drawer";
import {
  PortalTableToolbar,
  type PortalTableFilterField,
} from "@/components/portal/portal-table-toolbar";
import type { PortalTableParams } from "@/lib/portal-table";

type PortalTableToolbarDrawerProps = {
  basePath: string;
  fields: PortalTableFilterField[];
  preserved?: PortalTableParams & Record<string, string | undefined>;
  resetHref?: string;
  title?: string;
  description?: string;
  summary?: string;
  triggerLabel?: string;
};

export function PortalTableToolbarDrawer({
  basePath,
  fields,
  preserved,
  resetHref,
  title = "Filters",
  description,
  summary,
  triggerLabel = "Filters",
}: PortalTableToolbarDrawerProps) {
  return (
    <FilterDrawer title={title} description={description} summary={summary} triggerLabel={triggerLabel}>
      <PortalTableToolbar
        basePath={basePath}
        fields={fields}
        preserved={preserved}
        resetHref={resetHref}
        layout="stack"
      />
    </FilterDrawer>
  );
}
