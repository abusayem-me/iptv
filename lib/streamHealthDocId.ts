/** Stable Firestore document id for a stream URL (SHA-256 hex). */
export async function streamHealthDocId(streamUrl: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(streamUrl));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
