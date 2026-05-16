export function roleLabel(role: string) {
  if (role === "guard") return "Staff";
  if (role === "supervisor") return "Manager";
  if (role === "admin") return "Admin";
  return role;
}

export function formatPayRatePence(pence: number | null | undefined) {
  if (pence == null || Number.isNaN(pence)) return "—";
  return `£${(pence / 100).toFixed(2)}/hr`;
}

export function displayName(fullName: string | null | undefined, email: string) {
  const n = fullName?.trim();
  return n || email;
}
