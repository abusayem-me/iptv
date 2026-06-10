import { hlsProxyUrl } from "./hlsProxyUrl";

function resolveAgainstBase(base: string, ref: string): string | null {
  try {
    return new URL(ref, base).href;
  } catch {
    return null;
  }
}

/** Rewrite playlist lines so media and child playlists load through our proxy. */
export function rewriteM3u8(body: string, baseUrl: string, requestOrigin: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      let replaced = line.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
        const abs = resolveAgainstBase(baseUrl, uri);
        if (!abs || !/^https?:\/\//i.test(abs)) return `URI="${uri}"`;
        return `URI="${hlsProxyUrl(requestOrigin, abs)}"`;
      });
      replaced = replaced.replace(/URI=([^",\s]+)/g, (full, uri: string) => {
        if (typeof uri !== "string" || uri.startsWith('"')) return full;
        const abs = resolveAgainstBase(baseUrl, uri);
        if (!abs || !/^https?:\/\//i.test(abs)) return full;
        return `URI=${hlsProxyUrl(requestOrigin, abs)}`;
      });
      out.push(replaced);
      continue;
    }

    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }

    const abs = resolveAgainstBase(baseUrl, t);
    if (abs && /^https?:\/\//i.test(abs)) {
      out.push(hlsProxyUrl(requestOrigin, abs));
    } else {
      out.push(line);
    }
  }

  return out.join("\n");
}
