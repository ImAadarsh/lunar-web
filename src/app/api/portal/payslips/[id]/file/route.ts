import { NextResponse } from "next/server";
import { BACKEND_API_BASE } from "@/lib/backend";
import { getSessionFromCookies } from "@/lib/server-session";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = await context.params;
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "Invalid payslip id" }, { status: 400 });

  try {
    const upstream = await fetch(`${BACKEND_API_BASE}/payroll/payslips/${id}/file`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Payslip file not available" }, { status: upstream.status || 404 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/pdf",
        "Content-Disposition": upstream.headers.get("Content-Disposition") ?? `attachment; filename="payslip-${id}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 });
  }
}
