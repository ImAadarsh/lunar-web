"use client";

import { SubmitButton } from "@/components/portal/submit-button";
import { SiteGeofenceFields, type SiteGeofenceInitial } from "@/components/sites/site-geofence-fields";

export type SiteEditValues = SiteGeofenceInitial & {
  id: number;
};

type SiteEditFormProps = {
  site: SiteEditValues;
  updateAction: (formData: FormData) => Promise<void>;
};

export function SiteEditForm({ site, updateAction }: SiteEditFormProps) {
  return (
    <form action={updateAction} className="space-y-3">
      <input type="hidden" name="id" value={String(site.id)} />
      <SiteGeofenceFields
        showStatus
        initial={{
          name: site.name,
          address: site.address,
          centerLat: site.centerLat,
          centerLng: site.centerLng,
          geofenceRadiusM: site.geofenceRadiusM,
          geofencePolygon: site.geofencePolygon,
          isActive: site.isActive,
        }}
      />
      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
