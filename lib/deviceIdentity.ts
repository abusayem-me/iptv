const DEVICE_ID_KEY = "sayem-tv-device-id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id || id.length < 8) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `volatile-${Math.random().toString(36).slice(2)}`;
  }
}

export function describeClientDevice(): { label: string; platform: string } {
  if (typeof navigator === "undefined") {
    return { label: "Browser", platform: "Unknown" };
  }
  const ua = navigator.userAgent;
  let platform = "Other";
  if (/iPhone|iPad|iPod/i.test(ua)) platform = /iPad/i.test(ua) ? "iPad" : "iPhone";
  else if (/Android/i.test(ua)) platform = "Android";
  else if (/Mac OS X|Macintosh/i.test(ua)) platform = "macOS";
  else if (/Windows NT/i.test(ua)) platform = "Windows";
  else if (/Linux/i.test(ua)) platform = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  return { label: `${browser} · ${platform}`, platform };
}
