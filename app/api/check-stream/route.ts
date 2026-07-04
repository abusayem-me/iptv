import { NextRequest, NextResponse } from "next/server";
import { checkStreamUpstream, checkStreamsParallel } from "@/lib/checkStreamUpstream";

export const runtime = "nodejs";

const MAX_BATCH = 40;
const BATCH_CONCURRENCY = 24;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "missing url query" }, { status: 400 });
  }

  const result = await checkStreamUpstream(raw);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const urls = (body as { urls?: unknown }).urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "urls must be a non-empty array" }, { status: 400 });
  }
  if (urls.length > MAX_BATCH) {
    return NextResponse.json({ error: `max ${MAX_BATCH} urls per batch` }, { status: 400 });
  }
  if (!urls.every((u) => typeof u === "string" && u.length > 0)) {
    return NextResponse.json({ error: "urls must be strings" }, { status: 400 });
  }

  const checked = await checkStreamsParallel(urls as string[], { concurrency: BATCH_CONCURRENCY });
  const results: Record<string, { live: boolean; status?: number; detail?: string }> = {};
  for (const [url, result] of checked) {
    results[url] = result;
  }

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}
