import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { GuardAvailabilityBadge } from "@/components/portal/guard-availability-badge";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { mapBackendAvailability, type BackendAvailability } from "@/lib/dashboard-api";
import { formatUkDateTime, formatUkRange } from "@/lib/format-datetime";
import { shiftDutyLabel } from "@/lib/guard-availability";
import { getSessionFromCookies } from "@/lib/server-session";
import { redirect } from "next/navigation";

type GuardDashboardResponse = {
  user: {
    id: number;
    email: string;
    phone?: string | null;
    status: string;
    role: string;
    fullName?: string | null;
  };
  availability: BackendAvailability;
  currentShift: {
    id: number;
    siteId: number;
    siteName: string;
    startsAt: string;
    endsAt: string;
    status: string;
  } | null;
  shifts: Array<{
    id: number;
    siteId: number;
    siteName: string;
    startsAt: string;
    endsAt: string;
    status: string;
    dutyState?: string | null;
  }>;
};

type NotificationList = {
  items: Array<{
    id: number;
    title: string;
    body?: string;
    createdAt: string;
    readAt?: string | null;
  }>;
};

export default async function StaffPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "guard") redirect("/forbidden");

  const userId = session.user.id;
  const currentYear = new Date().getFullYear();

  const [dashRes, notificationsRes] = await Promise.all([
    backendApiWithSession<GuardDashboardResponse>(
      `/dashboard/guards/${userId}?year=${currentYear}`,
      session,
    ),
    backendApiWithSession<NotificationList>("/notifications?limit=10", session),
  ]);

  const shifts = dashRes.data?.shifts ?? [];
  const notifications = notificationsRes.data?.items ?? [];
  const availability = dashRes.data?.availability
    ? mapBackendAvailability(dashRes.data.availability)
    : null;
  const currentShift = dashRes.data?.currentShift ?? null;

  const loadErrors = [
    apiErrorMessage("Dashboard", dashRes),
    apiErrorMessage("Notifications", notificationsRes),
  ];

  return (
    <PortalPage>
      <PortalPageHeader title="My dashboard" description="Your duty status, shifts, and notifications.">
        <ApiErrorNotice errors={loadErrors} />
        {availability ? (
          <div className="flex flex-wrap items-center gap-3">
            <GuardAvailabilityBadge info={availability} showDetail />
          </div>
        ) : null}
        {currentShift && availability && availability.state !== "available" ? (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              availability.state === "on_duty"
                ? "border-sky-200 bg-sky-50 text-sky-900"
                : availability.state === "duty_not_started"
                  ? "border-orange-200 bg-orange-50 text-orange-900"
                  : availability.state === "missed_duty"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : availability.state === "assigned"
                      ? "border-violet-200 bg-violet-50 text-violet-900"
                      : "border-slate-200 bg-slate-50 text-slate-800"
            }`}
          >
            <span className="font-semibold">{shiftDutyLabel(availability.dutyState ?? availability.state)}</span>
            {" at "}
            <span className="font-semibold">{currentShift.siteName}</span>
            {availability.state === "assigned"
              ? ` · starts ${formatUkDateTime(currentShift.startsAt)}`
              : availability.state === "duty_not_started"
                ? " · please check in"
                : availability.state === "missed_duty"
                  ? " · you are available for reassignment"
                  : ` · until ${formatUkDateTime(currentShift.endsAt)}`}
          </p>
        ) : null}
      </PortalPageHeader>
      <PortalPageBody card={false}>
        <div className="grid gap-4 2xl:grid-cols-[1.2fr_1fr]">
          <section className="space-y-4">
            <article className="lunar-card lunar-card-pad">
              <h2 className="text-lg font-semibold text-slate-900">My profile</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Email" value={dashRes.data?.user.email ?? session.user.email} />
                <Field label="Role" value={dashRes.data?.user.role ?? "guard"} />
                <Field label="Status" value={dashRes.data?.user.status ?? "active"} />
                <Field label="Phone" value={dashRes.data?.user.phone ?? "Not set"} />
              </div>
            </article>

            <article className="lunar-card lunar-card-pad">
              <h2 className="text-lg font-semibold text-slate-900">My shifts</h2>
              <ul className="mt-4 space-y-2">
                {shifts.length === 0 ? (
                  <li className="text-sm text-slate-500">No shifts scheduled yet.</li>
                ) : null}
                {shifts.slice(0, 10).map((shift) => (
                  <li key={shift.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                    <p className="font-medium text-slate-900">
                      {shift.siteName} <span className="text-slate-400">#{shift.id}</span>
                    </p>
                    <p className="text-slate-600">{formatUkRange(shift.startsAt, shift.endsAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {shift.dutyState ? (
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {shiftDutyLabel(shift.dutyState)}
                        </span>
                      ) : null}
                      <span className="inline-flex rounded bg-lunar-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-lunar-800">
                        {shift.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="lunar-card lunar-card-pad">
            <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
            <ul className="mt-4 space-y-2">
              {notifications.length === 0 ? (
                <li className="text-sm text-slate-500">No notifications.</li>
              ) : null}
              {notifications.map((notice) => (
                <li
                  key={notice.id}
                  className={`rounded-lg border p-3 text-sm ${notice.readAt ? "border-slate-100" : "border-lunar-300 bg-lunar-50"}`}
                >
                  <p className="font-medium text-slate-900">{notice.title}</p>
                  {notice.body ? <p className="mt-1 text-slate-700">{notice.body}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">{formatUkDateTime(notice.createdAt)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PortalPageBody>
    </PortalPage>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
