"use client";

import { useState } from "react";

type AdminUserCreateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-[var(--portal-text)]">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {hint ? <span className="block text-xs text-[var(--portal-text-muted)]">{hint}</span> : null}
      {children}
    </label>
  );
}

export function AdminUserCreateForm({ action }: AdminUserCreateFormProps) {
  const [role, setRole] = useState<"guard" | "supervisor" | "admin">("guard");

  return (
    <form action={action} className="max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto pr-1">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" required>
          <input name="email" type="email" required autoComplete="off" placeholder="name@company.com" className="lunar-input" />
        </Field>
        <Field label="Password" required hint="Minimum 8 characters">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className="lunar-input"
          />
        </Field>
        <Field label="Role" required>
          <select name="role" required value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="lunar-input">
            <option value="guard">Staff (guard)</option>
            <option value="supervisor">Manager (supervisor)</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Status" required>
          <select name="status" defaultValue="active" required className="lunar-input">
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="suspended">Suspended</option>
          </select>
        </Field>
        <Field label="Phone" hint="E.164 format recommended, e.g. +447700900000">
          <input name="phone" type="tel" placeholder="+447700900000" className="lunar-input" />
        </Field>
        <Field label="Pay rate (pence/hour)" hint="Optional; used for payroll (e.g. 1200 = £12.00/hr)">
          <input name="payRatePenceHour" type="number" min={0} step={1} placeholder="1200" className="lunar-input" />
        </Field>
      </div>

      <p className="rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 py-2 text-sm text-[var(--portal-text-muted)]">
        After creating the user, open <strong className="text-[var(--portal-text)]">View</strong> or{" "}
        <strong className="text-[var(--portal-text)]">HR details</strong> in the users table to add documents,
        emergency contacts, and lifecycle events.
      </p>

      {role === "guard" ? (
        <fieldset className="space-y-3 rounded-lg border border-[var(--portal-border)] p-3">
          <legend className="px-1 text-sm font-semibold text-[var(--portal-text)]">Guard profile (app &amp; roster)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required>
              <input name="fullName" required={role === "guard"} placeholder="Jane Smith" className="lunar-input" />
            </Field>
            <Field label="Given names">
              <input name="givenNames" placeholder="Jane" className="lunar-input" />
            </Field>
            <Field label="Surname">
              <input name="surname" placeholder="Smith" className="lunar-input" />
            </Field>
            <Field label="Gender">
              <input name="gender" placeholder="female / male / other" className="lunar-input" />
            </Field>
            <Field label="Date of birth" hint="YYYY-MM-DD">
              <input name="dateOfBirth" type="date" className="lunar-input" />
            </Field>
            <Field label="SIA licence type">
              <input name="siaType" placeholder="Door Supervisor" className="lunar-input" />
            </Field>
            <Field label="SIA number">
              <input name="siaNumber" placeholder="1234-5678-9012" className="lunar-input" />
            </Field>
            <Field label="SIA expiry" hint="YYYY-MM-DD">
              <input name="siaExpiryDate" type="date" className="lunar-input" />
            </Field>
          </div>
        </fieldset>
      ) : null}

      <button type="submit" className="lunar-btn-primary w-full">
        Create user
      </button>
    </form>
  );
}
