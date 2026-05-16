import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { StatusBadge } from "@/components/portal/status-badge";
import { backendApiWithSession } from "@/lib/backend";
import { formatUkDateTime } from "@/lib/format-datetime";
import { mutateBackend } from "@/lib/portal-mutations";
import {
  getSessionCookieStoreOptions,
  SESSION_COOKIE_NAME,
  type SessionData,
  webRoleLabel,
} from "@/lib/session";
import { getSessionFromCookies } from "@/lib/server-session";
import { displayName, formatPayRatePence, roleLabel } from "@/lib/user-display";

type MyProfile = {
  id: number;
  email: string;
  phone?: string | null;
  status: "active" | "invited" | "suspended";
  role: "admin" | "supervisor" | "guard";
  createdAt?: string;
  payRatePenceHour?: number | null;
  fullName?: string | null;
  givenNames?: string | null;
  surname?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  siaType?: string | null;
  siaNumber?: string | null;
  siaExpiryDate?: string | null;
};

type ProfilePageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function MyProfilePage({ searchParams }: ProfilePageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const actionError = (sp.error ?? "").trim();
  const saved = sp.saved === "1";
  const userId = session.user.id;

  const userRes = await backendApiWithSession<MyProfile>(`/users/${userId}`, session);
  const user = userRes.data;

  if (!userRes.ok || !user) {
    return (
      <PortalPage>
        <PortalPageHeader title="My profile">
          <ApiErrorNotice errors={[userRes.error?.message ?? "Unable to load profile"]} />
        </PortalPageHeader>
      </PortalPage>
    );
  }

  const title = displayName(user.fullName, user.email);

  async function updateAccountAction(formData: FormData) {
    "use server";
    const current = await getSessionFromCookies();
    if (!current) redirect("/login");

    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    try {
      await mutateBackend(`/users/${current.user.id}`, "PATCH", {
        email: email || undefined,
        phone: phone || null,
        ...(password.length >= 8 ? { password } : {}),
      });
    } catch (e) {
      redirect(`/profile?error=${encodeURIComponent(e instanceof Error ? e.message : "Update failed")}`);
    }

    if (email && email !== current.user.email) {
      const jar = await cookies();
      jar.set(
        SESSION_COOKIE_NAME,
        JSON.stringify({
          ...current,
          user: { ...current.user, email },
        } satisfies SessionData),
        getSessionCookieStoreOptions(),
      );
    }

    revalidatePath("/profile");
    redirect("/profile?saved=1");
  }

  async function updateGuardProfileAction(formData: FormData) {
    "use server";
    const current = await getSessionFromCookies();
    if (!current) redirect("/login");
    if (current.user.role !== "guard") redirect("/profile");

    try {
      await mutateBackend(`/users/${current.user.id}`, "PATCH", {
        profile: {
          fullName: String(formData.get("fullName") ?? "").trim(),
          givenNames: String(formData.get("givenNames") ?? "").trim() || undefined,
          surname: String(formData.get("surname") ?? "").trim() || undefined,
          gender: String(formData.get("gender") ?? "").trim() || undefined,
          dateOfBirth: String(formData.get("dateOfBirth") ?? "").trim() || null,
          siaType: String(formData.get("siaType") ?? "").trim() || undefined,
          siaNumber: String(formData.get("siaNumber") ?? "").trim() || undefined,
          siaExpiryDate: String(formData.get("siaExpiryDate") ?? "").trim() || null,
        },
      });
    } catch (e) {
      redirect(`/profile?error=${encodeURIComponent(e instanceof Error ? e.message : "Profile update failed")}`);
    }

    revalidatePath("/profile");
    redirect("/profile?saved=1");
  }

  return (
    <PortalPage>
      <PortalPageHeader
        title={title}
        description={`${user.email} · ${roleLabel(user.role)}`}
      >
        {saved ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Profile saved.
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
        ) : null}
      </PortalPageHeader>

      <PortalPageBody card={false} scrollPage className="pb-10">
        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="lunar-card lunar-card-pad">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">Role</p>
            <p className="mt-1 font-medium">{roleLabel(user.role)}</p>
          </div>
          <div className="lunar-card lunar-card-pad">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">Status</p>
            <p className="mt-1">
              <StatusBadge status={user.status} />
            </p>
          </div>
          {user.payRatePenceHour != null ? (
            <div className="lunar-card lunar-card-pad">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">Pay rate</p>
              <p className="mt-1 font-medium">{formatPayRatePence(user.payRatePenceHour)}</p>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <article className="lunar-card lunar-card-pad">
            <h2 className="text-lg font-semibold text-[var(--portal-text)]">Account</h2>
            <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
              Update your login email, phone, and password.
            </p>
            <form action={updateAccountAction} className="mt-4 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Email</span>
                <input name="email" type="email" required defaultValue={user.email} className="lunar-input" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Phone</span>
                <input name="phone" type="tel" defaultValue={user.phone ?? ""} className="lunar-input" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">New password</span>
                <span className="block text-xs text-[var(--portal-text-muted)]">Leave blank to keep current</span>
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  className="lunar-input"
                />
              </label>
              {user.createdAt ? (
                <p className="text-xs text-[var(--portal-text-muted)]">
                  Member since {formatUkDateTime(user.createdAt)}
                </p>
              ) : null}
              <button type="submit" className="lunar-btn-primary w-full sm:w-auto">
                Save account
              </button>
            </form>
          </article>

          {user.role === "guard" ? (
            <article className="lunar-card lunar-card-pad">
              <h2 className="text-lg font-semibold text-[var(--portal-text)]">Staff profile</h2>
              <p className="mt-1 text-sm text-[var(--portal-text-muted)]">Name and SIA details for the mobile app.</p>
              <form action={updateGuardProfileAction} className="mt-4 space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Full name *</span>
                  <input name="fullName" required defaultValue={user.fullName ?? ""} className="lunar-input" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Given names</span>
                    <input name="givenNames" defaultValue={user.givenNames ?? ""} className="lunar-input" />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Surname</span>
                    <input name="surname" defaultValue={user.surname ?? ""} className="lunar-input" />
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Gender</span>
                  <input name="gender" defaultValue={user.gender ?? ""} className="lunar-input" />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Date of birth</span>
                  <input
                    name="dateOfBirth"
                    type="date"
                    defaultValue={user.dateOfBirth?.slice(0, 10) ?? ""}
                    className="lunar-input"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">SIA licence type</span>
                  <input name="siaType" defaultValue={user.siaType ?? ""} className="lunar-input" />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">SIA number</span>
                  <input name="siaNumber" defaultValue={user.siaNumber ?? ""} className="lunar-input" />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">SIA expiry</span>
                  <input
                    name="siaExpiryDate"
                    type="date"
                    defaultValue={user.siaExpiryDate?.slice(0, 10) ?? ""}
                    className="lunar-input"
                  />
                </label>
                <button type="submit" className="lunar-btn-primary w-full sm:w-auto">
                  Save profile
                </button>
              </form>
            </article>
          ) : (
            <article className="lunar-card lunar-card-pad">
              <h2 className="text-lg font-semibold text-[var(--portal-text)]">Portal access</h2>
              <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
                You are signed in as <strong>{webRoleLabel(user.role)}</strong>. Role and status are managed by an
                administrator.
              </p>
            </article>
          )}
        </section>
      </PortalPageBody>
    </PortalPage>
  );
}
