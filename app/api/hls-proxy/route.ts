import { NextRequest, NextResponse } from "next/server";
import { rewriteM3u8 } from "@/lib/rewriteM3u8";
import { isBlockedHostname } from "@/lib/ssrf";

export const runtime = "nodejs";

function looksLikeM3u8(contentType: string | null, peek: string): boolean {
  if (contentType?.includes("application/vnd.apple.mpegurl")) return true;
  if (contentType?.includes("application/x-mpegURL")) return true;
  if (contentType?.includes("audio/mpegurl")) return true;
  const s = peek.trimStart();
  return s.startsWith("#EXTM3U");
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "missing url query" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "only http(s)" }, { status: 400 });
  }

  if (isBlockedHostname(target.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  const origin = req.nextUrl.origin;

  let upstream: Response;
  try {
    upstream = await fetch(target.href, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!upstream.ok) {
    const t = await upstream.text().catch(() => "");
    return new NextResponse(t || upstream.statusText, { status: upstream.status });
  }

  const ct = upstream.headers.get("content-type");
  const buf = Buffer.from(await upstream.arrayBuffer());
  const peek = buf.slice(0, Math.min(2048, buf.length)).toString("utf8");

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (looksLikeM3u8(ct, peek)) {
    const text = buf.toString("utf8");
    const rewritten = rewriteM3u8(text, target.href, origin);
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": ct || "application/octet-stream",
      "Cache-Control": "public, max-age=60",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
