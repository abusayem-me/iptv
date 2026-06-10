import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

export type DevicePresenceRow = {
  id: string;
  label: string;
  platform: string;
  lastSeen: Timestamp | null;
  playingUrl: string | null;
  playingName: string | null;
  playingAt: Timestamp | null;
};

export function subscribeDevicePresence(
  uid: string,
  onRows: (rows: DevicePresenceRow[]) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db) return null;
  const col = collection(db, "userSettings", uid, "devices");
  return onSnapshot(col, (snap) => {
    const rows: DevicePresenceRow[] = snap.docs.map((d) => {
      const x = d.data() as Partial<Omit<DevicePresenceRow, "id">>;
      return {
        id: d.id,
        label: typeof x.label === "string" ? x.label : "Device",
        platform: typeof x.platform === "string" ? x.platform : "—",
        lastSeen: x.lastSeen ?? null,
        playingUrl: typeof x.playingUrl === "string" ? x.playingUrl : null,
        playingName: typeof x.playingName === "string" ? x.playingName : null,
        playingAt: x.playingAt ?? null,
      };
    });
    rows.sort((a, b) => (b.lastSeen?.toMillis?.() ?? 0) - (a.lastSeen?.toMillis?.() ?? 0));
    onRows(rows);
  });
}

export async function upsertDevicePresence(
  uid: string,
  deviceId: string,
  input: {
    label: string;
    platform: string;
    playingUrl: string | null;
    playingName: string | null;
  }
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const payload: Record<string, unknown> = {
    label: input.label,
    platform: input.platform,
    lastSeen: serverTimestamp(),
  };
  if (input.playingUrl && input.playingName) {
    payload.playingUrl = input.playingUrl;
    payload.playingName = input.playingName;
    payload.playingAt = serverTimestamp();
  } else {
    payload.playingUrl = null;
    payload.playingName = null;
    payload.playingAt = null;
  }
  await setDoc(doc(db, "userSettings", uid, "devices", deviceId), payload, { merge: true });
}

export async function removeDevicePresence(uid: string, deviceId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await deleteDoc(doc(db, "userSettings", uid, "devices", deviceId));
}
