/** Build same-origin HLS proxy URL (avoids browser CORS on playlists/segments). */
export function hlsProxyUrl(origin: string, targetUrl: string): string {
  const u = new URL("/api/hls-proxy", origin);
  u.searchParams.set("url", targetUrl);
  return u.href;
}
