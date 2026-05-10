import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const filename = "logo-without-bg.png";
  const filePath = path.resolve(process.cwd(), "..", filename);

  try {
    const bytes = await fs.readFile(filePath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Logo not found." }, { status: 404 });
  }
}

