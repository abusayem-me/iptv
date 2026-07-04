import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { HealthCheckStats } from "@/lib/runChannelHealthCheck";
import { streamHealthDocId } from "@/lib/streamHealthDocId";

export type GlobalStreamStatus = "live" | "dead";

export type StreamHealthDoc = {
  streamUrl: string;
  categoryId: string;
  status: GlobalStreamStatus;
  source: "check" | "playback";
  checkedAt: Timestamp | null;
  updatedBy: string;
};

export type CategoryHealthDoc = {
  checkedAt: Timestamp | null;
  stats: HealthCheckStats;
  updatedBy: string;
};

const STREAMS = "streamHealth";
const CATEGORIES = "categoryHealth";
export const ALL_CATEGORIES_ID = "all";

function mapSnapshotToHealth(snap: { docs: Array<{ data: () => unknown }> }): Map<string, GlobalStreamStatus> {
  const map = new Map<string, GlobalStreamStatus>();
  for (const d of snap.docs) {
    const x = d.data() as Partial<StreamHealthDoc>;
    if (x.streamUrl && (x.status === "live" || x.status === "dead")) {
      map.set(x.streamUrl, x.status);
    }
  }
  return map;
}

export function subscribeCategoryStreamHealth(
  categoryId: string,
  onMap: (health: Map<string, GlobalStreamStatus>) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db || !categoryId) return null;

  if (categoryId === ALL_CATEGORIES_ID) {
    return onSnapshot(collection(db, STREAMS), (snap) => onMap(mapSnapshotToHealth(snap)));
  }

  const q = query(collection(db, STREAMS), where("categoryId", "==", categoryId));
  return onSnapshot(q, (snap) => onMap(mapSnapshotToHealth(snap)));
}

export function subscribeCategoryHealthSummary(
  categoryId: string,
  onSummary: (checkedAt: number | null, stats: HealthCheckStats | null) => void
): Unsubscribe | null {
  const db = getFirebaseDb();
  if (!db || !categoryId) return null;

  return onSnapshot(doc(db, CATEGORIES, categoryId), (snap) => {
    if (!snap.exists()) {
      onSummary(null, null);
      return;
    }
    const x = snap.data() as Partial<CategoryHealthDoc>;
    const stats = x.stats;
    const checkedAt = x.checkedAt?.toMillis?.() ?? null;
    if (stats && typeof stats.total === "number") {
      onSummary(checkedAt, stats);
    } else {
      onSummary(checkedAt, null);
    }
  });
}

export async function upsertStreamHealthBatch(
  uid: string,
  entries: Array<{
    streamUrl: string;
    categoryId: string;
    status: GlobalStreamStatus;
    source: "check" | "playback";
  }>
): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !uid || entries.length === 0) return;

  for (let i = 0; i < entries.length; i += 400) {
    const slice = entries.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const e of slice) {
      const id = await streamHealthDocId(e.streamUrl);
      batch.set(
        doc(db, STREAMS, id),
        {
          streamUrl: e.streamUrl,
          categoryId: e.categoryId,
          status: e.status,
          source: e.source,
          checkedAt: serverTimestamp(),
          updatedBy: uid,
        },
        { merge: true }
      );
    }
    await batch.commit();
  }
}

export async function upsertStreamHealthFromPlayback(
  uid: string,
  streamUrl: string,
  categoryId: string,
  status: GlobalStreamStatus
): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !uid) return;
  const id = await streamHealthDocId(streamUrl);
  await setDoc(
    doc(db, STREAMS, id),
    {
      streamUrl,
      categoryId,
      status,
      source: "playback",
      checkedAt: serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true }
  );
}

export async function writeCategoryHealthSummary(
  uid: string,
  categoryId: string,
  stats: HealthCheckStats
): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !uid || !categoryId) return;
  await setDoc(
    doc(db, CATEGORIES, categoryId),
    {
      stats,
      checkedAt: serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true }
  );
}

export function formatHealthCheckedAgo(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}
