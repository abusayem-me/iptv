import {
  applyTheme,
  mergeWatchHistories,
  readTheme,
  readWatchHistory,
  writeFavoritesOrder,
  writeLibrarySync,
  writeRecent,
  writeWatchHistory,
} from "@/lib/browserPrefs";
import type { UserSettingsPayload } from "@/lib/firebase/userSettingsFirestore";
import type { LibrarySyncState, WatchHistoryEntry } from "@/lib/browserPrefsConstants";

/** Merge cloud `userSettings` fields into localStorage and theme (used after login + onSnapshot). */
export function applyRemoteUserSettingsToLocal(remote: UserSettingsPayload) {
  if (remote.favorites && Array.isArray(remote.favorites)) {
    writeFavoritesOrder(remote.favorites);
  }
  if (remote.recent && Array.isArray(remote.recent)) {
    writeRecent(remote.recent);
  }
  if (remote.watchHistory && Array.isArray(remote.watchHistory)) {
    const cleaned: WatchHistoryEntry[] = remote.watchHistory
      .filter(
        (e) =>
          !!e &&
          typeof e === "object" &&
          typeof (e as { streamUrl?: string }).streamUrl === "string" &&
          typeof (e as { lastAt?: number }).lastAt === "number" &&
          !Number.isNaN((e as { lastAt: number }).lastAt)
      )
      .map((e) => {
        const o = e as { streamUrl: string; name?: string; lastAt: number };
        return {
          streamUrl: o.streamUrl,
          name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Channel",
          lastAt: o.lastAt,
        };
      });
    const merged = mergeWatchHistories(readWatchHistory(), cleaned);
    writeWatchHistory(merged);
  }
  if (remote.theme === "light" || remote.theme === "dark") {
    applyTheme(remote.theme);
  } else {
    applyTheme(readTheme());
  }
  const lib: LibrarySyncState = {};
  if (typeof remote.lastChannelUrl === "string") lib.lastChannelUrl = remote.lastChannelUrl;
  if (remote.libraryView === "all" || remote.libraryView === "favorites") lib.libraryView = remote.libraryView;
  if (typeof remote.libraryCategory === "string") lib.libraryCategory = remote.libraryCategory;
  if (typeof remote.libraryQuery === "string") lib.libraryQuery = remote.libraryQuery;
  if (Object.keys(lib).length) writeLibrarySync(lib);
}
