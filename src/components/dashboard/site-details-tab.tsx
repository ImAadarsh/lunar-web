type SiteDetailsTabProps = {
  site: {
    address?: string | null;
    centerLat?: number;
    centerLng?: number;
    geofenceRadiusM?: number | null;
  };
};

export function SiteDetailsTab({ site }: SiteDetailsTabProps) {
  const mapsHref =
    site.centerLat != null && site.centerLng != null
      ? `https://www.google.com/maps?q=${site.centerLat},${site.centerLng}`
      : null;

  return (
    <section className="lunar-card lunar-card-pad max-w-2xl">
      <h3 className="portal-section-title">Site details</h3>
      <dl className="mt-4 space-y-3 text-sm">
        {site.address ? (
          <div>
            <dt className="text-slate-500">Address</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{site.address}</dd>
          </div>
        ) : null}
        {site.geofenceRadiusM != null ? (
          <div>
            <dt className="text-slate-500">Geofence</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{site.geofenceRadiusM} m radius</dd>
          </div>
        ) : null}
        {site.centerLat != null && site.centerLng != null ? (
          <div>
            <dt className="text-slate-500">Coordinates</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-800">
              {Number(site.centerLat).toFixed(5)}, {Number(site.centerLng).toFixed(5)}
            </dd>
          </div>
        ) : null}
      </dl>
      {mapsHref ? (
        <a href={mapsHref} target="_blank" rel="noreferrer" className="lunar-btn-secondary lunar-btn-sm mt-6 inline-flex">
          Open in Maps
        </a>
      ) : null}
    </section>
  );
}
