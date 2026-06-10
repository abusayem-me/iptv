import {
  FAV_STORAGE_KEY,
  LEGACY_FAV_STORAGE_KEY,
  LIBRARY_SYNC_KEY,
  MAX_RECENT,
  RECENT_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type LibrarySyncState,
  type LibraryViewPref,
  type RecentEntry,
  type ThemePref,
} from "@/lib/browserPrefsConstants";

export type { RecentEntry, ThemePref, LibrarySyncState, LibraryViewPref };

export function readFavoritesOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_FAV_STORAGE_KEY);
      if (raw) {
        try {
          localStorage.setItem(FAV_STORAGE_KEY, raw);
        } catch {
          /* quota */
        }
      }
    }
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const urls = arr.filter((x): x is string => typeof x === "string");
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of urls) {
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
  } catch {
    return [];
  }
}

export function writeFavoritesOrder(urls: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(urls));
  } catch {
    /* private mode / quota */
  }
}

export function readRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is RecentEntry => {
        if (!x || typeof x !== "object") return false;
        const o = x as Record<string, unknown>;
        return typeof o.streamUrl === "string";
      })
      .map((x) => {
        const o = x as RecentEntry;
        return {
          streamUrl: o.streamUrl,
          at: typeof o.at === "number" ? o.at : Date.now(),
        };
      })
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function writeRecent(entries: RecentEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function readTheme(): ThemePref {
  if (typeof window === "undefined") return "dark";
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Persist theme + update DOM + mobile theme-color meta. */
export function applyTheme(theme: ThemePref) {
  if (typeof document === "undefined") return;
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = theme === "light" ? "#e8ebf4" : "#05060d";
}

export function readLibrarySync(): LibrarySyncState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LIBRARY_SYNC_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return {};
    return j as LibrarySyncState;
  } catch {
    return {};
  }
}

export function writeLibrarySync(partial: LibrarySyncState) {
  if (typeof window === "undefined") return;
  try {
    const prev = readLibrarySync();
    const next = { ...prev, ...partial };
    localStorage.setItem(LIBRARY_SYNC_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function clearLibrarySync() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LIBRARY_SYNC_KEY);
  } catch {
    /* ignore */
  }
}

/** Build full Firestore-shaped payload from current localStorage (for first cloud upload). */
export function readLocalSettingsForCloud(): {
  favorites: string[];
  recent: RecentEntry[];
  theme: ThemePref;
  lastChannelUrl?: string;
  libraryView?: LibraryViewPref;
  libraryCategory?: string;
  libraryQuery?: string;
} {
  const lib = readLibrarySync();
  return {
    favorites: readFavoritesOrder(),
    recent: readRecent(),
    theme: readTheme(),
    lastChannelUrl: lib.lastChannelUrl,
    libraryView: lib.libraryView,
    libraryCategory: lib.libraryCategory,
    libraryQuery: lib.libraryQuery,
  };
}
