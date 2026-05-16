/** Minimal RFC-style CSV parser for admin bulk import (quoted fields, commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || (c === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      if (c === "\r") i++;
    } else if (c !== "\r") {
      field += c;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  return rows;
}

export type UserImportRow = {
  email: string;
  password: string;
  role: "admin" | "supervisor" | "guard";
  phone?: string;
  status?: "active" | "invited" | "suspended";
  payRatePenceHour?: string | number | null;
  fullName?: string;
  givenNames?: string;
  surname?: string;
  gender?: string;
  dateOfBirth?: string | null;
  siaType?: string;
  siaNumber?: string;
  siaExpiryDate?: string | null;
};

const HEADER_ALIASES: Record<string, keyof UserImportRow> = {
  email: "email",
  password: "password",
  role: "role",
  status: "status",
  phone: "phone",
  pay_rate_pence_hour: "payRatePenceHour",
  payratepencehour: "payRatePenceHour",
  full_name: "fullName",
  fullname: "fullName",
  given_names: "givenNames",
  givennames: "givenNames",
  surname: "surname",
  gender: "gender",
  date_of_birth: "dateOfBirth",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  sia_type: "siaType",
  siatype: "siaType",
  sia_number: "siaNumber",
  sianumber: "siaNumber",
  sia_expiry_date: "siaExpiryDate",
  siaexpirydate: "siaExpiryDate",
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export function csvToUserImportRows(text: string): UserImportRow[] {
  const grid = parseCsv(text.trim());
  if (grid.length < 2) return [];

  const headers = grid[0].map(normalizeHeader);
  const keys = headers.map((h) => HEADER_ALIASES[h] ?? null);

  const rows: UserImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const record: Partial<UserImportRow> = {};
    for (let c = 0; c < keys.length; c++) {
      const key = keys[c];
      if (!key) continue;
      const val = (cells[c] ?? "").trim();
      if (!val) continue;
      (record as Record<string, string>)[key] = val;
    }
    if (!record.email || !record.password || !record.role) continue;
    const role = record.role as string;
    if (role !== "admin" && role !== "supervisor" && role !== "guard") continue;
    rows.push({
      email: record.email!,
      password: record.password!,
      role,
      phone: record.phone,
      status: (record.status as UserImportRow["status"]) ?? "active",
      payRatePenceHour: record.payRatePenceHour ?? null,
      fullName: record.fullName,
      givenNames: record.givenNames,
      surname: record.surname,
      gender: record.gender,
      dateOfBirth: record.dateOfBirth ?? null,
      siaType: record.siaType,
      siaNumber: record.siaNumber,
      siaExpiryDate: record.siaExpiryDate ?? null,
    });
  }
  return rows;
}
