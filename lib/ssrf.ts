/** Block obvious SSRF targets for an open-ish stream proxy. */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;

  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (a.some((n) => n > 255)) return true;
    const [o0, o1] = a;
    if (o0 === 0 || o0 === 127 || o0 === 10) return true;
    if (o0 === 172 && o1 >= 16 && o1 <= 31) return true;
    if (o0 === 192 && o1 === 168) return true;
    if (o0 === 169 && o1 === 254) return true;
    if (o0 === 100 && o1 >= 64 && o1 <= 127) return true; /* CGNAT */
  }

  if (h.includes(":")) {
    const v6 = h.replace(/^::ffff:/i, "");
    if (v6.startsWith("fc") || v6.startsWith("fd")) return true; /* ULA */
    if (v6 === "fe80::1" || v6.startsWith("fe80:")) return true;
  }

  return false;
}
