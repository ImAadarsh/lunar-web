import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const pngPath = path.resolve(process.cwd(), "public", "logo-without-bg.png");
  const fallbackSvgPath = path.resolve(process.cwd(), "public", "lunar-logo.svg");

  try {
    const bytes = await fs.readFile(pngPath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    try {
      const bytes = await fs.readFile(fallbackSvgPath);
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      return NextResponse.json({ error: "Logo not found." }, { status: 404 });
    }
  }
}

