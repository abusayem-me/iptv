"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { VideoPlayer } from "./VideoPlayer";
import { hlsProxyUrl } from "@/lib/hlsProxyUrl";
import {
  applyTheme,
  readFavoritesOrder,
  readLibrarySync,
  readRecent,
  readTheme,
  mergeWatchHistoryEntry,
  readWatchHistory,
  writeFavoritesOrder,
  writeLibrarySync,
  writeRecent,
  writeWatchHistory,
  type RecentEntry,
  type ThemePref,
  type WatchHistoryEntry,
} from "@/lib/browserPrefs";
import { ChannelFilterPanel } from "@/app/components/ChannelFilterPanel";
import { AuthAccountModal } from "@/app/components/AuthAccountModal";
import { ProfileAccountPanel } from "@/app/components/ProfileAccountPanel";
import { useFirebaseAuth } from "@/app/contexts/FirebaseAuthContext";
import { applyRemoteUserSettingsToLocal } from "@/lib/firebase/applyRemoteSettings";
import {
  removeDevicePresence,
  subscribeDevicePresence,
  upsertDevicePresence,
  type DevicePresenceRow,
} from "@/lib/firebase/devicePresence";
import { getFirebaseDb } from "@/lib/firebase/client";
import { saveUserSettingsDoc, type UserSettingsPayload } from "@/lib/firebase/userSettingsFirestore";
import { getOrCreateDeviceId, describeClientDevice } from "@/lib/deviceIdentity";
import { MAX_RECENT } from "@/lib/browserPrefsConstants";
import { runChannelHealthCheck, type HealthCheckStats, type StreamHealth } from "@/lib/runChannelHealthCheck";
import {
  subscribeCategoryHealthSummary,
  subscribeCategoryStreamHealth,
  upsertStreamHealthBatch,
  upsertStreamHealthFromPlayback,
  writeCategoryHealthSummary,
} from "@/lib/firebase/streamHealthFirestore";

export type Channel = {
  category: string;
  name: string;
  streamUrl: string;
  logoUrl: string;
  logoAlt: string;
};

export type CategoryMeta = { id: string; title: string };

type Payload = {
  categories: CategoryMeta[];
  channels: Channel[];
};

type ViewFilter = "all" | "favorites";

type HealthFilter = "all" | "live" | "dead";

const PAGE_SIZE = 72;

function getDefaultCategoryId(channels: Channel[]): string {
  return channels.some((ch) => ch.category === "sports") ? "sports" : "all";
}

function humanCategory(id: string, title: string): string {
  const t = title.replace(/\s*\([^)]*CHANNEL[^)]*\)\s*/gi, "").trim();
  if (t.length > 2) return t;
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function TVApp() {
  const { user, hasFirebaseConfig, authLoading, prefsHydrateVersion, signOutUser, bumpPrefsHydrate } = useFirebaseAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [deviceRows, setDeviceRows] = useState<DevicePresenceRow[]>([]);
  const [remotePlayHint, setRemotePlayHint] = useState<{
    name: string;
    url: string;
    deviceLabel: string;
  } | null>(null);

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const deviceMeta = useMemo(() => describeClientDevice(), []);

  const canLoadChannels = useMemo(
    () => hasFirebaseConfig && !authLoading && !!user,
    [hasFirebaseConfig, authLoading, user]
  );
  const [data, setData] = useState<Payload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("sports");
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewFilter>("all");
  const [favOrder, setFavOrder] = useState<string[]>(() => []);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [active, setActive] = useState<Channel | null>(null);
  const [origin, setOrigin] = useState("");
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>(() => []);
  const [theme, setTheme] = useState<ThemePref>("dark");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [streamHealth, setStreamHealth] = useState<Map<string, StreamHealth>>(() => new Map());
  const [checkRunning, setCheckRunning] = useState(false);
  const [checkStats, setCheckStats] = useState<HealthCheckStats | null>(null);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [healthCheckedAt, setHealthCheckedAt] = useState<number | null>(null);
  const checkAbortRef = useRef<AbortController | null>(null);
  const checkRunningRef = useRef(false);

  useEffect(() => {
    checkRunningRef.current = checkRunning;
  }, [checkRunning]);

  const favSet = useMemo(() => new Set(favOrder), [favOrder]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setFavOrder(readFavoritesOrder());
    setRecentEntries(readRecent());
    setWatchHistory(readWatchHistory());
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
    if (!data) return;
    const lib = readLibrarySync();
    const defaultCat = getDefaultCategoryId(data.channels);
    const nextCat =
      lib.libraryCategory &&
      (lib.libraryCategory === "all" || data.categories.some((c) => c.id === lib.libraryCategory))
        ? lib.libraryCategory
        : defaultCat;
    const nextView: ViewFilter =
      lib.libraryView === "favorites" || lib.libraryView === "all" ? lib.libraryView : "all";
    const nextQ = typeof lib.libraryQuery === "string" ? lib.libraryQuery : "";
    setCat(nextCat);
    setView(nextView);
    setQ(nextQ);
    const url = lib.lastChannelUrl;
    const byUrl = url ? data.channels.find((c) => c.streamUrl === url) : undefined;
    const fallback = data.channels.find((ch) => ch.category === nextCat) ?? data.channels[0];
    setActive(byUrl ?? fallback ?? null);
  }, [prefsHydrateVersion, data]);

  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasFirebaseConfig || !user) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => {
      void saveUserSettingsDoc(user.uid, {
        favorites: favOrder,
        recent: recentEntries,
        watchHistory,
        theme,
        lastChannelUrl: active?.streamUrl,
        libraryView: view,
        libraryCategory: cat,
        libraryQuery: q,
      });
    }, 1200);
    return () => {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    };
  }, [user, hasFirebaseConfig, favOrder, recentEntries, watchHistory, theme, active?.streamUrl, view, cat, q]);

  const libLocalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!active) return;
    if (libLocalTimer.current) clearTimeout(libLocalTimer.current);
    libLocalTimer.current = setTimeout(() => {
      writeLibrarySync({
        lastChannelUrl: active.streamUrl,
        libraryView: view,
        libraryCategory: cat,
        libraryQuery: q,
      });
    }, 400);
    return () => {
      if (libLocalTimer.current) clearTimeout(libLocalTimer.current);
    };
  }, [active, view, cat, q]);

  useEffect(() => {
    if (!canLoadChannels) {
      setData(null);
      setActive(null);
      setLoadErr(null);
      return;
    }
    const ac = new AbortController();
    fetch("/api/channels", { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Payload) => {
        setData(j);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setLoadErr(msg);
      });
    return () => ac.abort();
  }, [canLoadChannels]);

  useEffect(() => {
    if (!hasFirebaseConfig || authLoading || user) return;
    setAuthModalOpen(true);
  }, [hasFirebaseConfig, authLoading, user]);

  useEffect(() => {
    if (!user || !hasFirebaseConfig) return;
    const db = getFirebaseDb();
    if (!db) return;
    const uref = doc(db, "userSettings", user.uid);
    const unsub = onSnapshot(uref, (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites) return;
      applyRemoteUserSettingsToLocal(snap.data() as UserSettingsPayload);
      bumpPrefsHydrate();
    });
    return () => unsub();
  }, [user, hasFirebaseConfig, bumpPrefsHydrate]);

  useEffect(() => {
    if (!user || !hasFirebaseConfig) return;
    const unsub = subscribeDevicePresence(user.uid, setDeviceRows);
    return () => {
      unsub?.();
    };
  }, [user, hasFirebaseConfig]);

  useEffect(() => {
    if (!user || !hasFirebaseConfig) return;
    const pushPresence = () => {
      void upsertDevicePresence(user.uid, deviceId, {
        label: deviceMeta.label,
        platform: deviceMeta.platform,
        playingUrl: active?.streamUrl ?? null,
        playingName: active?.name ?? null,
      });
    };
    pushPresence();
    const id = window.setInterval(pushPresence, 45_000);
    return () => clearInterval(id);
  }, [user, hasFirebaseConfig, deviceId, deviceMeta.label, deviceMeta.platform, active?.streamUrl, active?.name]);

  useEffect(() => {
    const others = deviceRows.filter(
      (d) =>
        d.id !== deviceId &&
        d.playingUrl &&
        d.playingName &&
        d.playingAt &&
        Date.now() - d.playingAt.toMillis() < 12 * 60 * 1000
    );
    const best = [...others].sort((a, b) => (b.playingAt?.toMillis() ?? 0) - (a.playingAt?.toMillis() ?? 0))[0];
    if (!best?.playingUrl || !best.playingName) {
      setRemotePlayHint(null);
      return;
    }
    if (best.playingUrl === active?.streamUrl) {
      setRemotePlayHint(null);
      return;
    }
    setRemotePlayHint({ url: best.playingUrl, name: best.playingName, deviceLabel: best.label });
  }, [deviceRows, deviceId, active?.streamUrl]);

  const categoryLabel = useMemo(() => {
    const m = new Map<string, string>();
    data?.categories.forEach((c) => {
      m.set(c.id, humanCategory(c.id, c.title));
    });
    return (id: string) => m.get(id) ?? id;
  }, [data]);

  const isFavReorderMode = view === "favorites" && cat === "all" && q.trim() === "";

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    let list: Channel[];

    if (view === "favorites") {
      const byUrl = new Map(data.channels.map((ch) => [ch.streamUrl, ch]));
      list = favOrder.map((url) => byUrl.get(url)).filter((ch): ch is Channel => !!ch);
    } else {
      list = data.channels;
    }

    if (cat !== "all") {
      list = list.filter((ch) => ch.category === cat);
    }
    if (term) {
      list = list.filter((ch) => {
        if (ch.name.toLowerCase().includes(term)) return true;
        const lab = categoryLabel(ch.category).toLowerCase();
        if (lab.includes(term)) return true;
        if (ch.category.toLowerCase().includes(term)) return true;
        if (ch.logoAlt.toLowerCase().includes(term)) return true;
        return false;
      });
    }

    return list;
  }, [data, cat, q, view, favOrder, categoryLabel]);

  const categoryCheckTargets = useMemo(() => {
    if (!data) return [];
    if (cat === "all") return data.channels;
    return data.channels.filter((ch) => ch.category === cat);
  }, [data, cat]);

  const checkTargetByUrl = useMemo(
    () => new Map(categoryCheckTargets.map((ch) => [ch.streamUrl, ch])),
    [categoryCheckTargets]
  );

  const healthFiltered = useMemo(() => {
    if (healthFilter === "all" || streamHealth.size === 0) return filtered;
    return filtered.filter((ch) => {
      const h = streamHealth.get(ch.streamUrl);
      if (healthFilter === "live") return h === "live";
      if (healthFilter === "dead") return h === "dead";
      return true;
    });
  }, [filtered, healthFilter, streamHealth]);

  useEffect(() => {
    checkAbortRef.current?.abort();
    checkAbortRef.current = null;
    setCheckRunning(false);
    setHealthFilter("all");

    if (!user || !hasFirebaseConfig) {
      setStreamHealth(new Map());
      setCheckStats(null);
      setHealthCheckedAt(null);
      return;
    }

    const unsubStreams = subscribeCategoryStreamHealth(cat, (map) => {
      if (checkRunningRef.current) return;
      setStreamHealth(map);
      if (map.size > 0) {
        let live = 0;
        let dead = 0;
        for (const s of map.values()) {
          if (s === "live") live++;
          else dead++;
        }
        setCheckStats((prev) => {
          const total = prev?.total ?? map.size;
          return { done: map.size, total, live, dead };
        });
      }
    });

    const unsubSummary = subscribeCategoryHealthSummary(cat, (checkedAt, stats) => {
      if (checkRunningRef.current) return;
      setHealthCheckedAt(checkedAt);
      if (stats) setCheckStats(stats);
    });

    return () => {
      unsubStreams?.();
      unsubSummary?.();
    };
  }, [cat, user, hasFirebaseConfig]);

  const startHealthCheck = useCallback(async () => {
    if (!origin || !user || categoryCheckTargets.length === 0 || checkRunning) return;
    checkAbortRef.current?.abort();
    const ac = new AbortController();
    checkAbortRef.current = ac;
    setCheckRunning(true);
    setHealthFilter("all");
    setStreamHealth(new Map());
    setHealthCheckedAt(null);
    setCheckStats({ done: 0, total: categoryCheckTargets.length, live: 0, dead: 0 });

    try {
      const results = await runChannelHealthCheck(origin, categoryCheckTargets, {
        signal: ac.signal,
        onUpdate: (streamUrl, health, stats) => {
          setStreamHealth((prev) => {
            const next = new Map(prev);
            next.set(streamUrl, health);
            return next;
          });
          setCheckStats(stats);
        },
        onBatchComplete: (batch) => {
          const entries = Array.from(batch.entries())
            .filter(([, h]) => h === "live" || h === "dead")
            .map(([streamUrl, status]) => ({
              streamUrl,
              categoryId: checkTargetByUrl.get(streamUrl)?.category ?? cat,
              status: status as "live" | "dead",
              source: "check" as const,
            }));
          if (entries.length > 0) {
            void upsertStreamHealthBatch(user.uid, entries);
          }
        },
      });

      if (!ac.signal.aborted) {
        let live = 0;
        let dead = 0;
        for (const h of results.values()) {
          if (h === "live") live++;
          else if (h === "dead") dead++;
        }
        const finalStats: HealthCheckStats = {
          done: results.size,
          total: categoryCheckTargets.length,
          live,
          dead,
        };
        await writeCategoryHealthSummary(user.uid, cat, finalStats);
        setHealthCheckedAt(Date.now());
        setCheckStats(finalStats);
        if (finalStats.live > 0) setHealthFilter("live");
      }
    } finally {
      if (checkAbortRef.current === ac) {
        checkAbortRef.current = null;
        setCheckRunning(false);
      }
    }
  }, [origin, user, categoryCheckTargets, checkRunning, cat, checkTargetByUrl]);

  const stopHealthCheck = useCallback(() => {
    checkAbortRef.current?.abort();
    checkAbortRef.current = null;
    setCheckRunning(false);
  }, []);

  const playbackHealthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPlaybackHealth = useCallback(
    (status: "live" | "dead") => {
      if (!user || !active) return;
      setStreamHealth((prev) => {
        const next = new Map(prev);
        next.set(active.streamUrl, status);
        return next;
      });
      if (playbackHealthTimer.current) clearTimeout(playbackHealthTimer.current);
      playbackHealthTimer.current = setTimeout(() => {
        void upsertStreamHealthFromPlayback(user.uid, active.streamUrl, active.category, status);
      }, 600);
    },
    [user, active]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [cat, q, view, favOrder.length, healthFilter]);

  useEffect(() => {
    if (isFavReorderMode) {
      setVisibleCount((n) => Math.max(n, filtered.length));
    }
  }, [isFavReorderMode, filtered.length]);

  const effectiveCap = isFavReorderMode ? healthFiltered.length : visibleCount;
  const visibleChannels = useMemo(() => healthFiltered.slice(0, effectiveCap), [healthFiltered, effectiveCap]);

  const continueChannels = useMemo(() => {
    if (!data) return [];
    const byUrl = new Map(data.channels.map((ch) => [ch.streamUrl, ch]));
    return recentEntries.map((e) => byUrl.get(e.streamUrl)).filter((ch): ch is Channel => !!ch);
  }, [data, recentEntries]);

  useEffect(() => {
    if (!data || !active) return;
    setRecentEntries((prev) => {
      const base = prev.length === 0 ? readRecent() : prev;
      const rest = base.filter((r) => r.streamUrl !== active.streamUrl);
      const next = [{ streamUrl: active.streamUrl, at: Date.now() }, ...rest].slice(0, MAX_RECENT);
      writeRecent(next);
      return next;
    });
    setWatchHistory((prev) => {
      const base = prev.length === 0 ? readWatchHistory() : prev;
      const next = mergeWatchHistoryEntry(base, active.streamUrl, active.name, Date.now());
      writeWatchHistory(next);
      return next;
    });
  }, [data, active?.streamUrl, active?.name]);

  const proxiedSrc = useMemo(() => {
    if (!active || !origin) return "";
    return hlsProxyUrl(origin, active.streamUrl);
  }, [active, origin]);

  const onPick = useCallback((ch: Channel) => {
    setActive(ch);
  }, []);

  const toggleFav = useCallback((streamUrl: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavOrder((prev) => {
      const i = prev.indexOf(streamUrl);
      const next = i >= 0 ? prev.filter((u) => u !== streamUrl) : [...prev, streamUrl];
      writeFavoritesOrder(next);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    if (!data) return;
    const dc = getDefaultCategoryId(data.channels);
    setCat(dc);
    setQ("");
    setView("all");
    setHealthFilter("all");
    const first = data.channels.find((ch) => ch.category === dc) ?? data.channels[0];
    if (first) setActive(first);
  }, [data]);

  const clearContinue = useCallback(() => {
    writeRecent([]);
    setRecentEntries([]);
  }, []);

  const setThemeChoice = useCallback((t: ThemePref) => {
    setTheme(t);
    applyTheme(t);
  }, []);

  const onDragStartFav = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!isFavReorderMode) return;
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
      setDragIdx(index);
    },
    [isFavReorderMode]
  );

  const onDragEndFav = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  const onDragOverFav = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!isFavReorderMode) return;
      e.preventDefault();
      setDragOverIdx(index);
    },
    [isFavReorderMode]
  );

  const onDropFav = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      if (!isFavReorderMode) return;
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
      setDragIdx(null);
      setDragOverIdx(null);
      if (Number.isNaN(from) || from === dropIndex) return;
      setFavOrder((prev) => {
        const next = reorderArray(prev, from, dropIndex);
        writeFavoritesOrder(next);
        return next;
      });
    },
    [isFavReorderMode]
  );

  const defaultCatId = useMemo(
    () => (data ? getDefaultCategoryId(data.channels) : "sports"),
    [data]
  );

  const hasHealthResults = streamHealth.size > 0;
  const healthFilterActive = healthFilter !== "all" && streamHealth.size > 0;

  const hasActiveFilters =
    !!data &&
    (cat !== defaultCatId || q.trim() !== "" || view !== "all" || healthFilter !== "all");

  const profileFavoriteRows = useMemo(() => {
    if (!data) return [];
    const byUrl = new Map(data.channels.map((ch) => [ch.streamUrl, ch]));
    return favOrder.map((url) => byUrl.get(url)).filter((ch): ch is Channel => !!ch);
  }, [data, favOrder]);

  const profileWatchedRows = useMemo(() => {
    return watchHistory.map((h) => {
      if (!data) {
        return {
          streamUrl: h.streamUrl,
          name: h.name,
          logoUrl: "",
          logoAlt: "",
          lastAt: h.lastAt,
        };
      }
      const ch = data.channels.find((c) => c.streamUrl === h.streamUrl);
      return ch
        ? { streamUrl: ch.streamUrl, name: ch.name, logoUrl: ch.logoUrl, logoAlt: ch.logoAlt, lastAt: h.lastAt }
        : { streamUrl: h.streamUrl, name: h.name, logoUrl: "", logoAlt: "", lastAt: h.lastAt };
    });
  }, [data, watchHistory]);

  const profileDrawer =
    user && hasFirebaseConfig ? (
      <ProfileAccountPanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        thisDeviceId={deviceId}
        devices={deviceRows}
        onRemoveDevice={(id) => void removeDevicePresence(user.uid, id)}
        favorites={profileFavoriteRows.map((ch) => ({
          streamUrl: ch.streamUrl,
          name: ch.name,
          logoUrl: ch.logoUrl,
        }))}
        watched={profileWatchedRows}
        canPlay={!!data}
        onPlayChannel={(streamUrl) => {
          if (!data) return;
          const ch = data.channels.find((c) => c.streamUrl === streamUrl);
          if (ch) setActive(ch);
          setProfileOpen(false);
        }}
      />
    ) : null;

  const siteHeader = (
    <header className="site-header">
      <div className="brand">
          <img className="brand-mark" src="/brand-mark.svg" alt="SAYEM TV" width={44} height={44} decoding="async" />
        <div>
          <h1>SAYEM TV</h1>
          <p className="tagline">Live channels in your browser</p>
        </div>
      </div>
      <div className="header-actions">
        {hasFirebaseConfig ? (
          <div className="firebase-auth">
            {authLoading ? (
              <span className="firebase-auth-status">Account…</span>
            ) : user ? (
              <>
                <span className="firebase-auth-email" title={user.email ?? user.uid}>
                  {user.email ?? "Signed in"}
                </span>
                <button type="button" className="btn-ghost btn-auth" onClick={() => setProfileOpen(true)}>
                  Profile
                </button>
                <button type="button" className="btn-ghost btn-auth" onClick={() => void signOutUser()}>
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-ghost btn-auth btn-auth-primary"
                onClick={() => setAuthModalOpen(true)}
              >
                Sign in
              </button>
            )}
          </div>
        ) : (
          <span className="firebase-auth-status" title="Add NEXT_PUBLIC_FIREBASE_* to .env.local">
            Cloud off
          </span>
        )}
        <div className="theme-toggle" role="group" aria-label="Color theme">
          <button
            type="button"
            className={theme === "dark" ? "active" : ""}
            onClick={() => setThemeChoice("dark")}
            aria-pressed={theme === "dark"}
          >
            Dark
          </button>
          <button
            type="button"
            className={theme === "light" ? "active" : ""}
            onClick={() => setThemeChoice("light")}
            aria-pressed={theme === "light"}
          >
            Light
          </button>
        </div>
        {active ? (
          <div className="now-playing" aria-live="polite">
            <span className="np-label">Now playing</span>
            <span className="np-title">{active.name}</span>
          </div>
        ) : null}
      </div>
    </header>
  );

  if (!hasFirebaseConfig) {
    return (
      <div className="tv-layout">
        {siteHeader}
        <div className="auth-gate notice error">
          <h2 className="auth-gate-title">Firebase is not configured</h2>
          <p>
            Add <code>NEXT_PUBLIC_FIREBASE_*</code> variables (see <code>docs/FIREBASE.md</code>) so sign-in and sync
            work. The channel library is only available to signed-in users.
          </p>
        </div>
        {profileDrawer}
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="tv-layout">
        {siteHeader}
        <div className="notice">Checking your account…</div>
        {profileDrawer}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="tv-layout">
        {siteHeader}
        <section className="auth-gate" aria-labelledby="auth-gate-heading">
          <h2 id="auth-gate-heading" className="auth-gate-title">
            Sign in to watch
          </h2>
          <p className="auth-gate-copy">
            Create an account or sign in with Google so your favorites, continue watching, and library sync across all
            your devices.
          </p>
          <button type="button" className="btn-auth btn-auth-primary auth-gate-cta" onClick={() => setAuthModalOpen(true)}>
            Sign in or create account
          </button>
        </section>
        <AuthAccountModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        {profileDrawer}
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="tv-layout">
        {siteHeader}
        <div className="notice error">
          Could not load channel list ({loadErr}). Ensure <code>data/channels.json</code> exists — run{" "}
          <code>npm run parse-channels</code>.
        </div>
        <AuthAccountModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        {profileDrawer}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="tv-layout">
        {siteHeader}
        <div className="notice">Loading channels…</div>
        <AuthAccountModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        {profileDrawer}
      </div>
    );
  }

  return (
    <div className="tv-layout">
      {siteHeader}

      {remotePlayHint ? (
        <div className="cross-play-banner" role="status">
          <span className="cross-play-text">
            <strong>{remotePlayHint.deviceLabel}</strong> is playing <strong>{remotePlayHint.name}</strong>
          </span>
          <button
            type="button"
            className="btn-cross-play"
            onClick={() => {
              const ch = data.channels.find((c) => c.streamUrl === remotePlayHint.url);
              if (ch) setActive(ch);
              setRemotePlayHint(null);
            }}
          >
            Watch here
          </button>
          <button type="button" className="btn-cross-dismiss" onClick={() => setRemotePlayHint(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      <section className="player-section">
        {active && proxiedSrc ? (
          <VideoPlayer
            key={proxiedSrc}
            src={proxiedSrc}
            channelName={active.name}
            onPlaybackHealth={onPlaybackHealth}
          />
        ) : (
          <div className="player-placeholder">Select a channel</div>
        )}
      </section>

      {continueChannels.length > 0 ? (
        <section className="continue-section" aria-labelledby="continue-heading">
          <div className="continue-head">
            <h2 id="continue-heading" className="continue-title">
              Continue watching
            </h2>
            <button type="button" className="btn-text" onClick={clearContinue}>
              Clear
            </button>
          </div>
          <div className="continue-scroll" role="list">
            {continueChannels.map((ch) => (
              <button
                key={ch.streamUrl}
                type="button"
                role="listitem"
                className={`continue-card ${active?.streamUrl === ch.streamUrl ? "is-playing" : ""}`}
                onClick={() => onPick(ch)}
              >
                <div className="continue-logo">
                  <img
                    src={ch.logoUrl?.trim() ? ch.logoUrl : "/tv-logo-placeholder.svg"}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.dataset.fallback === "1") return;
                      el.dataset.fallback = "1";
                      el.src = "/tv-logo-placeholder.svg";
                    }}
                  />
                </div>
                <span className="continue-name">{ch.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <ChannelFilterPanel
        q={q}
        onSearchChange={setQ}
        view={view}
        onViewChange={setView}
        favCount={favOrder.length}
        cat={cat}
        onCategoryChange={setCat}
        categories={data.categories}
        categoryLabel={categoryLabel}
        filteredCount={filtered.length}
        shownCount={healthFiltered.length}
        totalCount={data.channels.length}
        healthFilterActive={healthFilterActive}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={clearFilters}
        categoryCheckCount={categoryCheckTargets.length}
        checkRunning={checkRunning}
        checkStats={checkStats}
        healthCheckedAt={healthCheckedAt}
        hasHealthResults={hasHealthResults}
        healthFilter={healthFilter}
        onHealthFilterChange={setHealthFilter}
        onStartHealthCheck={() => void startHealthCheck()}
        onStopHealthCheck={stopHealthCheck}
      />

      {view === "favorites" && favOrder.length > 1 && !isFavReorderMode ? (
        <p className="reorder-hint">
          To drag and reorder favorites, open <strong>Favorites</strong>, choose <strong>All categories</strong>, and
          clear the search box.
        </p>
      ) : null}

          {isFavReorderMode ? (
        <p className="reorder-hint" role="status">
          Drag the <strong>⋮⋮</strong> handle on each card to reorder favorites. Order syncs to your account when signed
          in.
        </p>
      ) : null}

      <div className="channel-grid">
        {visibleChannels.map((ch, idx) => {
          const isFav = favSet.has(ch.streamUrl);
          const health = streamHealth.get(ch.streamUrl);
          return (
            <div
              key={ch.streamUrl}
              className={`ch-cell ${isFavReorderMode ? "has-drag-handle" : ""} ${dragIdx === idx ? "is-dragging" : ""} ${dragOverIdx === idx ? "drag-over" : ""} ${health === "dead" ? "ch-dead" : ""}`}
              onDragOver={(e) => onDragOverFav(e, idx)}
              onDrop={(e) => onDropFav(e, idx)}
            >
              {isFavReorderMode ? (
                <div
                  className="ch-drag-handle"
                  draggable
                  onDragStart={(e) => onDragStartFav(e, idx)}
                  onDragEnd={onDragEndFav}
                  title="Drag to reorder"
                  aria-label={`Reorder ${ch.name}`}
                >
                  <span aria-hidden>⋮⋮</span>
                </div>
              ) : null}
              {health ? (
                <span
                  className={`ch-health ch-health-${health}`}
                  title={health === "live" ? "Stream responded" : health === "dead" ? "Stream unreachable or error" : "Checking…"}
                >
                  {health === "checking" ? "…" : health === "live" ? "Live" : "Dead"}
                </span>
              ) : null}
              <button
                type="button"
                draggable={false}
                className={`ch-fav-btn ${isFav ? "is-fav" : ""}`}
                onClick={(e) => toggleFav(ch.streamUrl, e)}
                aria-pressed={isFav}
                aria-label={isFav ? `Remove ${ch.name} from favorites` : `Add ${ch.name} to favorites`}
                title={isFav ? "Remove from favorites" : "Add to favorites"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} aria-hidden>
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    d="M12 3.2l2.35 4.76 5.26.77-3.8 3.7.9 5.24L12 15.9l-4.7 2.47.9-5.24-3.8-3.7 5.26-.77L12 3.2z"
                  />
                </svg>
              </button>
              <button
                type="button"
                draggable={false}
                className={active?.streamUrl === ch.streamUrl ? "ch-card playing" : "ch-card"}
                onClick={() => onPick(ch)}
              >
                <span className="ch-logo-wrap">
                  <img
                    src={ch.logoUrl?.trim() ? ch.logoUrl : "/tv-logo-placeholder.svg"}
                    alt=""
                    className="ch-logo"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (el.dataset.fallback === "1") return;
                      el.dataset.fallback = "1";
                      el.src = "/tv-logo-placeholder.svg";
                    }}
                  />
                </span>
                <span className="ch-name">{ch.name}</span>
                <span className="ch-cat">{categoryLabel(ch.category)}</span>
              </button>
            </div>
          );
        })}
      </div>

      {!isFavReorderMode && visibleCount < healthFiltered.length ? (
        <div className="load-more-wrap">
          <button type="button" className="btn-load-more" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
            Load more ({healthFiltered.length - visibleCount} left)
          </button>
        </div>
      ) : null}

      {healthFiltered.length === 0 && filtered.length > 0 ? (
        <p className="empty">No {healthFilter} channels in this view. Try another filter or re-run the check.</p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="empty">
          {view === "favorites" && favOrder.length === 0
            ? "No favorites yet. Use the star on a channel card to save it here."
            : "No channels match your filters."}
        </p>
      ) : null}

      <AuthAccountModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      {profileDrawer}
    </div>
  );
}
