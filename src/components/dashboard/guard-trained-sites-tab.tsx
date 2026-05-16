import Link from "next/link";
import { formatUkDateOnly, formatUkTrainedOn } from "@/lib/format-datetime";
import { trainedSiteDutyBadge, type GuardAvailabilityInfo } from "@/lib/guard-availability";

type TrainedSiteRow = {
  siteId: number;
  siteName: string;
  trainedOn?: string | null;
};

type GuardTrainedSitesTabProps = {
  sites: TrainedSiteRow[];
  currentSiteId?: number | null;
  availability: GuardAvailabilityInfo;
  siaNumber?: string | null;
  siaExpiryDate?: string | null;
};

export function GuardTrainedSitesTab({
  sites,
  currentSiteId,
  availability,
  siaNumber,
  siaExpiryDate,
}: GuardTrainedSitesTabProps) {
  return (
    <div className="space-y-4">
      {siaNumber ? (
        <section className="lunar-card lunar-card-pad">
          <h3 className="portal-section-title">SIA licence</h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-slate-500">Number</dt>
              <dd className="font-medium text-slate-900">{siaNumber}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-slate-500">Expiry</dt>
              <dd className="font-medium text-slate-900">{formatUkDateOnly(siaExpiryDate)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="lunar-card lunar-card-pad">
        <h3 className="portal-section-title">Trained sites</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Sites this guard is cleared to work. Open a site dashboard for roster and shifts.
        </p>
        <div className="lunar-table-wrap mt-4">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Trained on</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                    No trained sites recorded yet.
                  </td>
                </tr>
              ) : null}
              {sites.map((site) => {
                const dutyBadge = trainedSiteDutyBadge(site.siteId, currentSiteId, availability);
                return (
                  <tr key={site.siteId} className="border-t border-slate-100">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/manager/sites/${site.siteId}`}
                        className="font-medium text-lunar-800 hover:underline"
                      >
                        {site.siteName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{formatUkTrainedOn(site.trainedOn)}</td>
                    <td className="px-3 py-2.5">
                      {dutyBadge ? (
                        <span className={dutyBadge.className}>{dutyBadge.label}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
