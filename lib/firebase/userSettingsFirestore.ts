import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { LibraryViewPref, RecentEntry, ThemePref } from "@/lib/browserPrefsConstants";
import { getFirebaseDb } from "@/lib/firebase/client";

export type UserSettingsPayload = {
  favorites?: string[];
  recent?: RecentEntry[];
  theme?: ThemePref;
  lastChannelUrl?: string;
  libraryView?: LibraryViewPref;
  libraryCategory?: string;
  libraryQuery?: string;
};

const COLLECTION = "userSettings";

export async function loadUserSettingsDoc(uid: string): Promise<UserSettingsPayload | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return snap.data() as UserSettingsPayload;
}

export async function saveUserSettingsDoc(uid: string, payload: UserSettingsPayload): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const cleaned = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  await setDoc(
    doc(db, COLLECTION, uid),
    {
      ...cleaned,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
