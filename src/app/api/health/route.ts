import { NextResponse } from "next/server";

/** Lightweight check for load balancers and post-deploy scripts (not auth-gated). */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
