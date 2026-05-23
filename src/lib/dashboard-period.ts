const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Default dashboard period: last 30 days inclusive. */
export function defaultDashboardDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/** Forward-looking calendar default: today through the next 30 days inclusive. */
export function forwardDashboardDateRange(): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 30);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export type DashboardPeriodParams = {
  from: string;
  to: string;
};

export function parseDashboardPeriodSearchParams(
  sp: {
    from?: string;
    to?: string;
    year?: string;
    month?: string;
  },
  fallback: () => DashboardPeriodParams = defaultDashboardDateRange,
): DashboardPeriodParams {
  const fromRaw = sp.from?.trim();
  const toRaw = sp.to?.trim();
  if (fromRaw && toRaw && DATE_ONLY.test(fromRaw) && DATE_ONLY.test(toRaw)) {
    return fromRaw <= toRaw ? { from: fromRaw, to: toRaw } : { from: toRaw, to: fromRaw };
  }

  // Legacy year/month → convert to calendar bounds
  const year = Number(sp.year);
  if (Number.isFinite(year) && year >= 2020 && year <= 2100) {
    const month = sp.month?.trim() ? Math.min(12, Math.max(1, Number(sp.month) || 0)) : 0;
    if (month) {
      const lastDay = new Date(year, month, 0).getDate();
      return {
        from: `${year}-${pad2(month)}-01`,
        to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
      };
    }
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }

  return fallback();
}

export function buildDashboardQuery(period: DashboardPeriodParams, extra?: Record<string, string>) {
  const q = new URLSearchParams({ from: period.from, to: period.to });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  return q;
}

/** Focus dashboard tab link (`calendar` omits from/to — matches tab nav `resetDates`). */
export function buildFocusTabHref(
  basePath: string,
  tab: string,
  period?: DashboardPeriodParams | null,
) {
  const params =
    tab === "calendar" || !period
      ? new URLSearchParams({ tab })
      : new URLSearchParams({ from: period.from, to: period.to, tab });
  return `${basePath}?${params}`;
}

export function buildGuardCalendarHref(userId: number) {
  return buildFocusTabHref(`/manager/guards/${userId}`, "calendar");
}

export function buildSiteCalendarHref(siteId: number) {
  return buildFocusTabHref(`/manager/sites/${siteId}`, "calendar");
}

/** All-sites shift calendar on the manager Shifts page. */
export function buildMegaCalendarHref(period?: DashboardPeriodParams | null) {
  const params =
    period && period.from && period.to
      ? new URLSearchParams({ tab: "calendar", from: period.from, to: period.to })
      : new URLSearchParams({ tab: "calendar" });
  return `/manager/shifts?${params}`;
}
