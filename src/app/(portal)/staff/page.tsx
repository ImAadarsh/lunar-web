import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";
import { redirect } from "next/navigation";

type UserProfile = {
  id: number;
  email: string;
  phone?: string;
  status: string;
  role: string;
  created_at?: string;
};

type ShiftList = {
  items: Array<{
    id: number;
    siteId: number;
    startsAt: string;
    endsAt: string;
    status: string;
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

  const [profileRes, shiftsRes, notificationsRes] = await Promise.all([
    backendApiWithSession<UserProfile>(`/users/${session.user.id}`, session),
    backendApiWithSession<ShiftList>(`/shifts?userId=${session.user.id}`, session),
    backendApiWithSession<NotificationList>("/notifications?limit=10", session),
  ]);

  const shifts = shiftsRes.data?.items ?? [];
  const notifications = notificationsRes.data?.items ?? [];
  const loadErrors = [
    apiErrorMessage("Profile", profileRes),
    apiErrorMessage("Shifts", shiftsRes),
    apiErrorMessage("Notifications", notificationsRes),
  ];

  return (
    <div className="grid gap-4 2xl:grid-cols-[1.2fr_1fr]">
      <div className="2xl:col-span-2">
        <ApiErrorNotice errors={loadErrors} />
      </div>
      <section className="space-y-4">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">My profile</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Email" value={profileRes.data?.email ?? session.user.email} />
            <Field label="Role" value={profileRes.data?.role ?? "guard"} />
            <Field label="Status" value={profileRes.data?.status ?? "active"} />
            <Field label="Phone" value={profileRes.data?.phone ?? "Not set"} />
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">My shifts</h2>
          <ul className="mt-4 space-y-2">
            {shifts.slice(0, 10).map((shift) => (
              <li key={shift.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-900">Shift #{shift.id} • Site {shift.siteId}</p>
                <p className="text-slate-600">
                  {new Date(shift.startsAt).toLocaleString()} - {new Date(shift.endsAt).toLocaleString()}
                </p>
                <p className="mt-1 inline-flex rounded bg-lunar-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-lunar-800">
                  {shift.status}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
        <ul className="mt-4 space-y-2">
          {notifications.map((notice) => (
            <li
              key={notice.id}
              className={`rounded-lg border p-3 text-sm ${notice.readAt ? "border-slate-100" : "border-lunar-300 bg-lunar-50"}`}
            >
              <p className="font-medium text-slate-900">{notice.title}</p>
              {notice.body ? <p className="mt-1 text-slate-700">{notice.body}</p> : null}
              <p className="mt-2 text-xs text-slate-500">{new Date(notice.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
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

