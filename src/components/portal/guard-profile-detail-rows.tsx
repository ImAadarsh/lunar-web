import type { DetailRow } from "@/components/portal/detail-table";
import { formatUkDateOnly } from "@/lib/format-datetime";
import { displayGuardName } from "@/lib/leave-month-stats";

export type GuardProfileFields = {
  guardName?: string | null;
  guardGivenNames?: string | null;
  guardSurname?: string | null;
  userEmail: string;
  userPhone?: string | null;
  userStatus?: string | null;
  userRole?: string | null;
  guardGender?: string | null;
  guardDateOfBirth?: string | null;
  guardSiaType?: string | null;
  guardSiaNumber?: string | null;
  guardSiaExpiryDate?: string | null;
};

function formatDate(value?: string | null) {
  return formatUkDateOnly(value);
}

/** DetailTable rows for guard HR / contact fields. */
export function guardProfileDetailRows(guard: GuardProfileFields): DetailRow[] {
  const name = displayGuardName(guard.guardName, guard.userEmail);

  return [
    { label: "Full name", value: name },
    {
      label: "Given / surname",
      value:
        guard.guardGivenNames?.trim() || guard.guardSurname?.trim()
          ? [guard.guardGivenNames, guard.guardSurname].filter(Boolean).join(" ")
          : "—",
    },
    {
      label: "Email",
      value: (
        <a href={`mailto:${guard.userEmail}`} className="portal-link break-all">
          {guard.userEmail}
        </a>
      ),
    },
    {
      label: "Mobile",
      value: guard.userPhone?.trim() ? (
        <a href={`tel:${guard.userPhone.replace(/\s/g, "")}`} className="portal-link">
          {guard.userPhone}
        </a>
      ) : (
        "—"
      ),
    },
    { label: "Account status", value: guard.userStatus ?? "—" },
    { label: "Role", value: guard.userRole ?? "—" },
    { label: "Gender", value: guard.guardGender?.trim() || "—" },
    { label: "Date of birth", value: formatDate(guard.guardDateOfBirth) },
    { label: "SIA licence type", value: guard.guardSiaType?.trim() || "—" },
    { label: "SIA number", value: guard.guardSiaNumber?.trim() || "—" },
    { label: "SIA expiry", value: formatDate(guard.guardSiaExpiryDate) },
  ];
}
