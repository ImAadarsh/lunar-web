import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PortalBackButton } from "@/components/portal/portal-back-button";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalModal } from "@/components/portal/portal-modal";
import { PortalPage, PortalPageBody, PortalPageHeader } from "@/components/portal/portal-page-layout";
import { StatusBadge } from "@/components/portal/status-badge";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { formatUkDateOnly, formatUkDateTime } from "@/lib/format-datetime";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";
import { displayName, formatPayRatePence, roleLabel } from "@/lib/user-display";

type UserDetail = {
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

type HrProfile = {
  user: { id: number; email: string; phone?: string | null; status: string; role: string };
  documents: Array<{ id: number; title: string; documentType: string; status: string; expiresOn?: string | null }>;
  emergencyContacts: Array<{ id: number; name: string; relationship?: string | null; phone: string; email?: string | null }>;
  lifecycle: Array<{ id: number; eventType: string; notes?: string | null; effectiveOn?: string | null; createdAt: string }>;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function AdminUserDetailPage({ params, searchParams }: PageProps) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");

  const { id } = await params;
  const userId = Number(id);
  if (!userId) redirect("/admin/users");

  const sp = await searchParams;
  const actionError = (sp.error ?? "").trim();
  const saved = sp.saved === "1";

  const userRes = await backendApiWithSession<UserDetail>(`/users/${userId}`, session);
  const hrRes = await backendApiWithSession<HrProfile>(`/hr/users/${userId}`, session);
  const user = userRes.data;
  const hrLoadError = apiErrorMessage("HR profile", hrRes);
  const hr = hrRes.ok && hrRes.data
    ? hrRes.data
    : { documents: [], emergencyContacts: [], lifecycle: [] };

  if (!userRes.ok || !user) {
    return (
      <PortalPage>
        <PortalPageHeader
          title="User"
          actions={
            <PortalBackButton fallbackHref="/admin/users" className="lunar-btn-secondary lunar-btn-sm">
              Back
            </PortalBackButton>
          }
        >
          <ApiErrorNotice errors={[apiErrorMessage("User", userRes)]} />
        </PortalPageHeader>
      </PortalPage>
    );
  }

  const basePath = `/admin/users/${userId}`;
  const listPath = "/admin/users";

  async function updateAccountAction(formData: FormData) {
    "use server";
    const role = String(formData.get("role") ?? "") as "admin" | "supervisor" | "guard";
    const status = String(formData.get("status") ?? "") as "active" | "invited" | "suspended";
    const phone = String(formData.get("phone") ?? "").trim();
    const payRateRaw = String(formData.get("payRatePenceHour") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    try {
      await mutateBackend(`/users/${userId}`, "PATCH", {
        role,
        status,
        phone: phone || null,
        payRatePenceHour: payRateRaw ? Number(payRateRaw) : null,
        ...(password.length >= 8 ? { password } : {}),
      });
    } catch (e) {
      redirect(`${basePath}?error=${encodeURIComponent(e instanceof Error ? e.message : "Update failed")}`);
    }
    revalidatePath(listPath);
    revalidatePath(basePath);
    redirect(`${basePath}?saved=1`);
  }

  async function updateGuardProfileAction(formData: FormData) {
    "use server";
    try {
      await mutateBackend(`/users/${userId}`, "PATCH", {
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
      redirect(`${basePath}?error=${encodeURIComponent(e instanceof Error ? e.message : "Profile update failed")}`);
    }
    revalidatePath(listPath);
    revalidatePath(basePath);
    redirect(`${basePath}?saved=1`);
  }

  async function suspendAction() {
    "use server";
    await mutateBackend(`/users/${userId}`, "DELETE");
    revalidatePath(listPath);
    revalidatePath(basePath);
    redirect(`${basePath}?saved=1`);
  }

  async function reactivateAction() {
    "use server";
    await mutateBackend(`/users/${userId}`, "PATCH", { status: "active" });
    revalidatePath(listPath);
    revalidatePath(basePath);
    redirect(`${basePath}?saved=1`);
  }

  async function addDocumentAction(formData: FormData) {
    "use server";
    const title = String(formData.get("title") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "").trim();
    const expiresOn = String(formData.get("expiresOn") ?? "").trim();
    if (!title || !documentType) return;
    await mutateBackend(`/hr/users/${userId}/documents`, "POST", {
      title,
      documentType,
      expiresOn: expiresOn || undefined,
    });
    revalidatePath(basePath);
  }

  async function addContactAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const relationship = String(formData.get("relationship") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    if (!name || !phone) return;
    await mutateBackend(`/hr/users/${userId}/emergency-contacts`, "POST", {
      name,
      relationship: relationship || undefined,
      phone,
      email: email || undefined,
    });
    revalidatePath(basePath);
  }

  async function addLifecycleAction(formData: FormData) {
    "use server";
    const eventType = String(formData.get("eventType") ?? "status_change");
    const notes = String(formData.get("notes") ?? "").trim();
    const effectiveOn = String(formData.get("effectiveOn") ?? "").trim();
    await mutateBackend(`/hr/users/${userId}/lifecycle`, "POST", {
      eventType,
      notes: notes || undefined,
      effectiveOn: effectiveOn || undefined,
    });
    revalidatePath(basePath);
    revalidatePath(listPath);
  }

  const title = displayName(user.fullName, user.email);

  return (
    <PortalPage>
      <PortalPageHeader
        title={title}
        description={`${user.email} · ${roleLabel(user.role)} · ${user.status}`}
        actions={
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <PortalBackButton fallbackHref={listPath} className="lunar-btn-secondary lunar-btn-sm w-full justify-center sm:w-auto">
              Back
            </PortalBackButton>
            {user.role === "guard" ? (
              <Link
                href={`/manager/guards/${userId}`}
                className="lunar-btn-secondary lunar-btn-sm w-full justify-center sm:w-auto"
              >
                Ops dashboard
              </Link>
            ) : null}
            {user.status !== "suspended" ? (
              <form action={suspendAction} className="w-full sm:w-auto">
                <button type="submit" className="lunar-btn-danger lunar-btn-sm w-full sm:w-auto">
                  Suspend user
                </button>
              </form>
            ) : (
              <form action={reactivateAction} className="w-full sm:w-auto">
                <button type="submit" className="lunar-btn-primary lunar-btn-sm w-full sm:w-auto">
                  Reactivate
                </button>
              </form>
            )}
          </div>
        }
      >
        {saved ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Changes saved.
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
        ) : null}
      </PortalPageHeader>

      <PortalPageBody card={false} scrollPage className="px-0.5 pb-10">
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="lunar-card lunar-card-pad">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">Phone</p>
            <p className="mt-1 font-medium">{user.phone?.trim() || "—"}</p>
          </div>
          <div className="lunar-card lunar-card-pad">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--portal-text-muted)]">Pay rate</p>
            <p className="mt-1 font-medium">{formatPayRatePence(user.payRatePenceHour)}</p>
          </div>
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-2 lg:items-start">
          <article className="lunar-card lunar-card-pad min-h-0">
            <h2 className="text-lg font-semibold text-[var(--portal-text)]">Account</h2>
            <p className="mt-1 text-sm text-[var(--portal-text-muted)]">Login, role, status, and payroll settings.</p>
            <form action={updateAccountAction} className="mt-4 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Email</span>
                <input type="text" value={user.email} disabled className="lunar-input opacity-70" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">New password</span>
                <span className="block text-xs text-[var(--portal-text-muted)]">Leave blank to keep current</span>
                <input name="password" type="password" minLength={8} autoComplete="new-password" className="lunar-input" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Role</span>
                  <select name="role" defaultValue={user.role} className="lunar-input">
                    <option value="guard">Staff (guard)</option>
                    <option value="supervisor">Manager (supervisor)</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Status</span>
                  <select name="status" defaultValue={user.status} className="lunar-input">
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Phone</span>
                <input name="phone" type="tel" defaultValue={user.phone ?? ""} className="lunar-input" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Pay rate (pence/hour)</span>
                <input
                  name="payRatePenceHour"
                  type="number"
                  min={0}
                  defaultValue={user.payRatePenceHour ?? ""}
                  placeholder="1200"
                  className="lunar-input"
                />
              </label>
              {user.createdAt ? (
                <p className="text-xs text-[var(--portal-text-muted)]">
                  Created {formatUkDateTime(user.createdAt)}
                </p>
              ) : null}
              <button type="submit" className="lunar-btn-primary w-full sm:w-auto">
                Save account
              </button>
            </form>
          </article>

          {user.role === "guard" ? (
            <article className="lunar-card lunar-card-pad min-h-0">
              <h2 className="text-lg font-semibold text-[var(--portal-text)]">Guard profile</h2>
              <p className="mt-1 text-sm text-[var(--portal-text-muted)]">Name and SIA details shown in ops and mobile app.</p>
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
                  <input name="dateOfBirth" type="date" defaultValue={user.dateOfBirth?.slice(0, 10) ?? ""} className="lunar-input" />
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
                  <input name="siaExpiryDate" type="date" defaultValue={user.siaExpiryDate?.slice(0, 10) ?? ""} className="lunar-input" />
                </label>
                <button type="submit" className="lunar-btn-primary w-full sm:w-auto">
                  Save profile
                </button>
              </form>
            </article>
          ) : (
            <article className="lunar-card lunar-card-pad">
              <h2 className="text-lg font-semibold text-[var(--portal-text)]">Profile</h2>
              <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
                Guard-specific fields (name, SIA) apply only to staff accounts. This user is a {roleLabel(user.role).toLowerCase()}.
              </p>
            </article>
          )}
        </section>

        <section id="hr" className="mt-2 scroll-mt-24">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--portal-text)]">HR details</h2>
              <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
                Documents, emergency contacts, and lifecycle events for this employee.
              </p>
            </div>
            {user.role === "guard" ? (
              <Link
                href={`/manager/guards/${userId}`}
                className="lunar-btn-secondary lunar-btn-sm w-full justify-center sm:w-auto"
              >
                Ops dashboard
              </Link>
            ) : null}
          </div>
          {hrLoadError ? <ApiErrorNotice errors={[hrLoadError]} /> : null}
          <div className="grid gap-4 xl:grid-cols-3">
            <article className="lunar-card lunar-card-pad">
              <h3 className="font-semibold text-slate-900">HR documents</h3>
              <div className="mt-3">
                <PortalModal triggerLabel="Add document" title="Add HR document" triggerClassName="lunar-btn-secondary lunar-btn-sm">
                  <form action={addDocumentAction} className="grid gap-2">
                    <input name="title" required placeholder="Document title" className="lunar-input" />
                    <input name="documentType" required placeholder="contract, right_to_work, sia_license…" className="lunar-input" />
                    <input name="expiresOn" type="date" className="lunar-input" />
                    <button type="submit" className="lunar-btn-primary">
                      Save
                    </button>
                  </form>
                </PortalModal>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {hr.documents.length === 0 ? (
                  <li className="text-[var(--portal-text-muted)]">No documents</li>
                ) : (
                  hr.documents.map((doc) => (
                    <li key={doc.id} className="rounded-lg border border-slate-100 p-2">
                      {doc.title} · {doc.documentType} · {doc.status}
                      {doc.expiresOn ? ` · exp ${formatUkDateOnly(doc.expiresOn)}` : ""}
                    </li>
                  ))
                )}
              </ul>
            </article>

            <article className="lunar-card lunar-card-pad">
              <h3 className="font-semibold text-slate-900">Emergency contacts</h3>
              <div className="mt-3">
                <PortalModal triggerLabel="Add contact" title="Add emergency contact" triggerClassName="lunar-btn-secondary lunar-btn-sm">
                  <form action={addContactAction} className="grid gap-2">
                    <input name="name" required placeholder="Name" className="lunar-input" />
                    <input name="relationship" placeholder="Relationship" className="lunar-input" />
                    <input name="phone" required placeholder="Phone" className="lunar-input" />
                    <input name="email" type="email" placeholder="Email" className="lunar-input" />
                    <button type="submit" className="lunar-btn-primary">
                      Save
                    </button>
                  </form>
                </PortalModal>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {hr.emergencyContacts.length === 0 ? (
                  <li className="text-[var(--portal-text-muted)]">No contacts</li>
                ) : (
                  hr.emergencyContacts.map((contact) => (
                    <li key={contact.id} className="rounded-lg border border-slate-100 p-2">
                      {contact.name} · {contact.relationship ?? "contact"} · {contact.phone}
                    </li>
                  ))
                )}
              </ul>
            </article>

            <article className="lunar-card lunar-card-pad">
              <h3 className="font-semibold text-slate-900">Lifecycle</h3>
              <div className="mt-3">
                <PortalModal triggerLabel="Record event" title="Record lifecycle event" triggerClassName="lunar-btn-secondary lunar-btn-sm">
                  <form action={addLifecycleAction} className="grid gap-2">
                    <select name="eventType" defaultValue="status_change" className="lunar-input">
                      <option value="onboarding">Onboarding</option>
                      <option value="status_change">Status change</option>
                      <option value="offboarding">Offboarding</option>
                      <option value="archive">Archive</option>
                    </select>
                    <input name="effectiveOn" type="date" className="lunar-input" />
                    <textarea name="notes" placeholder="Notes" className="lunar-input min-h-[4rem]" />
                    <button type="submit" className="lunar-btn-primary">
                      Save
                    </button>
                  </form>
                </PortalModal>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {hr.lifecycle.length === 0 ? (
                  <li className="text-[var(--portal-text-muted)]">No events</li>
                ) : (
                  hr.lifecycle.map((event) => (
                    <li key={event.id} className="rounded-lg border border-slate-100 p-2">
                      {event.eventType} ·{" "}
                      {event.effectiveOn ? formatUkDateOnly(event.effectiveOn) : formatUkDateTime(event.createdAt)}
                    </li>
                  ))
                )}
              </ul>
            </article>
          </div>
        </section>
      </PortalPageBody>
    </PortalPage>
  );
}
