import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApiErrorNotice } from "@/components/portal/api-error-notice";
import { PortalModal } from "@/components/portal/portal-modal";
import { apiErrorMessage, backendApiWithSession } from "@/lib/backend";
import { mutateBackend } from "@/lib/portal-mutations";
import { getSessionFromCookies } from "@/lib/server-session";

type HrProfile = {
  user: { id: number; email: string; phone?: string | null; status: string; role: string };
  documents: Array<{ id: number; title: string; documentType: string; status: string; expiresOn?: string | null }>;
  emergencyContacts: Array<{ id: number; name: string; relationship?: string | null; phone: string; email?: string | null }>;
  lifecycle: Array<{ id: number; eventType: string; notes?: string | null; effectiveOn?: string | null; createdAt: string }>;
};

export default async function AdminUserHrPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/forbidden");
  const { id } = await params;
  const userId = Number(id);
  const profileRes = await backendApiWithSession<HrProfile>(`/hr/users/${userId}`, session);
  const profile = profileRes.data;
  if (!profileRes.ok) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="text-sm font-semibold text-lunar-700 hover:underline">
          Back to users
        </Link>
        <ApiErrorNotice errors={[apiErrorMessage("HR profile", profileRes)]} />
      </div>
    );
  }
  if (!profile) redirect("/admin/users");

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
    revalidatePath(`/admin/users/${userId}`);
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
    revalidatePath(`/admin/users/${userId}`);
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
    revalidatePath(`/admin/users/${userId}`);
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm font-semibold text-lunar-700 hover:underline">
        Back to users
      </Link>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{profile.user.email}</h2>
        <p className="text-sm text-slate-500">
          {profile.user.role} • {profile.user.status} • {profile.user.phone ?? "no phone"}
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">HR documents</h3>
          <div className="mt-3">
            <PortalModal triggerLabel="Add Document" title="Add HR document" triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white">
              <form action={addDocumentAction} className="grid gap-2">
                <input name="title" required placeholder="Document title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="documentType" required placeholder="contract, right_to_work, policy..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="expiresOn" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white">Save Document</button>
              </form>
            </PortalModal>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {profile.documents.map((doc) => (
              <li key={doc.id} className="rounded-lg border border-slate-100 p-2">
                {doc.title} • {doc.documentType} • {doc.status}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Emergency contacts</h3>
          <div className="mt-3">
            <PortalModal triggerLabel="Add Contact" title="Add emergency contact" triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white">
              <form action={addContactAction} className="grid gap-2">
                <input name="name" required placeholder="Name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="relationship" placeholder="Relationship" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="phone" required placeholder="Phone" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="email" type="email" placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white">Save Contact</button>
              </form>
            </PortalModal>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {profile.emergencyContacts.map((contact) => (
              <li key={contact.id} className="rounded-lg border border-slate-100 p-2">
                {contact.name} • {contact.relationship ?? "contact"} • {contact.phone}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Lifecycle</h3>
          <div className="mt-3">
            <PortalModal triggerLabel="Record Event" title="Record lifecycle event" triggerClassName="w-full rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white">
              <form action={addLifecycleAction} className="grid gap-2">
                <select name="eventType" defaultValue="status_change" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="onboarding">Onboarding</option>
                  <option value="status_change">Status change</option>
                  <option value="offboarding">Offboarding</option>
                  <option value="archive">Archive</option>
                </select>
                <input name="effectiveOn" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <textarea name="notes" placeholder="Notes" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button className="rounded-lg bg-lunar-700 px-4 py-2 text-sm font-semibold text-white">Save Event</button>
              </form>
            </PortalModal>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {profile.lifecycle.map((event) => (
              <li key={event.id} className="rounded-lg border border-slate-100 p-2">
                {event.eventType} • {event.effectiveOn ?? new Date(event.createdAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
