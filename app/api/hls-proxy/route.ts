import { NextRequest, NextResponse } from "next/server";
import { rewriteM3u8 } from "@/lib/rewriteM3u8";
import { isBlockedHostname } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPSTREAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

const PASSTHROUGH_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "cache-control",
  "etag",
  "last-modified",
];

function getRequestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

function looksLikeM3u8(contentType: string | null, peek: string): boolean {
  if (contentType?.includes("application/vnd.apple.mpegurl")) return true;
  if (contentType?.includes("application/x-mpegURL")) return true;
  if (contentType?.includes("audio/mpegurl")) return true;
  if (contentType?.includes("mpegurl")) return true;
  return peek.trimStart().startsWith("#EXTM3U");
}

function isPlaylistUrl(target: URL): boolean {
  return /\.m3u8(?:\?|$)/i.test(target.pathname);
}

function buildUpstreamHeaders(req: NextRequest, target: URL): HeadersInit {
  const headers: Record<string, string> = { ...UPSTREAM_HEADERS, Referer: `${target.origin}/` };
  const range = req.headers.get("range");
  if (range) headers.Range = range;
  return headers;
}

function passthroughHeaders(upstream: Response): Record<string, string> {
  const out: Record<string, string> = { ...CORS };
  for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out[name] = value;
  }
  if (!out["content-type"]) out["content-type"] = "application/octet-stream";
  if (!out["cache-control"]) out["cache-control"] = "public, max-age=60";
  return out;
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

  const origin = getRequestOrigin(req);
  const likelyPlaylist = isPlaylistUrl(target);

  let upstream: Response;
  try {
    upstream = await fetch(target.href, {
      redirect: "follow",
      headers: buildUpstreamHeaders(req, target),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!upstream.ok) {
    const t = await upstream.text().catch(() => "");
    return new NextResponse(t || upstream.statusText, {
      status: upstream.status,
      headers: CORS,
    });
  }

  if (!likelyPlaylist) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: passthroughHeaders(upstream),
    });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  const peek = buf.slice(0, Math.min(2048, buf.length)).toString("utf8");
  const ct = upstream.headers.get("content-type");

  if (looksLikeM3u8(ct, peek)) {
    const rewritten = rewriteM3u8(buf.toString("utf8"), target.href, origin);
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  return new NextResponse(buf, {
    status: upstream.status,
    headers: passthroughHeaders(upstream),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  });
}
