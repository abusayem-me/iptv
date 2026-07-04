import { isBlockedHostname } from "@/lib/ssrf";

export type StreamCheckResult = {
  live: boolean;
  status?: number;
  detail?: string;
};

const MAX_PROBE_BYTES = 2048;
export const DEFAULT_STREAM_CHECK_TIMEOUT_MS = 4500;
export const FAST_STREAM_CHECK_TIMEOUT_MS = 3000;

function looksLikeM3u8(contentType: string | null, peek: string): boolean {
  if (contentType?.includes("application/vnd.apple.mpegurl")) return true;
  if (contentType?.includes("application/x-mpegURL")) return true;
  if (contentType?.includes("audio/mpegurl")) return true;
  return peek.trimStart().startsWith("#EXTM3U");
}

async function readResponsePrefix(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.subarray(0, maxBytes);
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value?.byteLength) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, maxBytes);
}

function classifyProbe(buf: Buffer, contentType: string | null, status: number): StreamCheckResult {
  if (buf.length === 0) {
    return { live: false, status, detail: "empty response" };
  }

  const peek = buf.toString("utf8");
  if (looksLikeM3u8(contentType, peek)) {
    return { live: true, status };
  }

  if (buf.length >= 188) {
    return { live: true, status };
  }

  return { live: false, status, detail: "response too small" };
}

/** Probe an upstream stream URL (same SSRF rules as hls-proxy). */
export async function checkStreamUpstream(
  rawUrl: string,
  timeoutMs = DEFAULT_STREAM_CHECK_TIMEOUT_MS
): Promise<StreamCheckResult> {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return { live: false, detail: "invalid url" };
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return { live: false, detail: "only http(s)" };
  }

  if (isBlockedHostname(target.hostname)) {
    return { live: false, detail: "host not allowed" };
  }

  try {
    const res = await fetch(target.href, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        Range: `bytes=0-${MAX_PROBE_BYTES - 1}`,
      },
    });

    if (!res.ok && res.status !== 206) {
      return { live: false, status: res.status, detail: res.statusText || "upstream error" };
    }

    const buf = await readResponsePrefix(res, MAX_PROBE_BYTES);
    return classifyProbe(buf, res.headers.get("content-type"), res.status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { live: false, detail: msg };
  }
}

/** Check many URLs in parallel on the server (used by batch API + health runner). */
export async function checkStreamsParallel(
  urls: string[],
  opts?: { concurrency?: number; timeoutMs?: number; signal?: AbortSignal }
): Promise<Map<string, StreamCheckResult>> {
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 20, 32));
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_STREAM_CHECK_TIMEOUT_MS;
  const results = new Map<string, StreamCheckResult>();
  let idx = 0;

  const worker = async () => {
    while (idx < urls.length) {
      if (opts?.signal?.aborted) return;
      const i = idx++;
      const url = urls[i];
      if (!url) return;
      results.set(url, await checkStreamUpstream(url, timeoutMs));
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
  return results;
}
