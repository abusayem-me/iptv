import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  const file = path.join(process.cwd(), "data", "channels.json");
  try {
    const raw = fs.readFileSync(file, "utf8");
    return new NextResponse(raw, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "channels.json not found. Run: npm run parse-channels" }, { status: 404 });
  }
}
