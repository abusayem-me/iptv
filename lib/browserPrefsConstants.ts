/** Browser localStorage keys — keep in sync with Firestore `userSettings` payload. */

export const FAV_STORAGE_KEY = "sayem-tv-favorites";
export const LEGACY_FAV_STORAGE_KEY = "iptv-tvstream-favorites";
export const RECENT_STORAGE_KEY = "sayem-tv-recent";
export const THEME_STORAGE_KEY = "sayem-tv-theme";
/** Library UI + last channel (synced when signed in). */
export const LIBRARY_SYNC_KEY = "sayem-tv-library-sync";
/** Deduped watch log for profile / cross-device sync (longer than continue strip). */
export const WATCH_HISTORY_KEY = "sayem-tv-watch-history";

export const MAX_RECENT = 20;
export const MAX_WATCH_HISTORY = 120;

export type ThemePref = "dark" | "light";

export type RecentEntry = { streamUrl: string; at: number };

/** Last time each channel was watched (for profile + Firestore sync). */
export type WatchHistoryEntry = { streamUrl: string; name: string; lastAt: number };

export type LibraryViewPref = "all" | "favorites";

export type LibrarySyncState = {
  lastChannelUrl?: string;
  libraryView?: LibraryViewPref;
  libraryCategory?: string;
  libraryQuery?: string;
};
