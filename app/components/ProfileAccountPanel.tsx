"use client";

import type { User } from "firebase/auth";
import type { DevicePresenceRow } from "@/lib/firebase/devicePresence";
import { MAX_WATCH_HISTORY } from "@/lib/browserPrefsConstants";

function formatSeen(ts: { toMillis: () => number } | null | undefined): string {
  if (!ts || typeof ts.toMillis !== "function") return "—";
  const diff = Date.now() - ts.toMillis();
  if (diff < 12_000) return "Active now";
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function formatWatchedAt(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export type ProfileFavoriteRow = { streamUrl: string; name: string; logoUrl: string };
export type ProfileWatchedRow = { streamUrl: string; name: string; logoUrl: string; logoAlt?: string; lastAt: number };

export function ProfileAccountPanel({
  open,
  onClose,
  user,
  thisDeviceId,
  devices,
  onRemoveDevice,
  favorites,
  watched,
  canPlay,
  onPlayChannel,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  thisDeviceId: string;
  devices: DevicePresenceRow[];
  onRemoveDevice: (deviceId: string) => void;
  favorites: ProfileFavoriteRow[];
  watched: ProfileWatchedRow[];
  canPlay: boolean;
  onPlayChannel: (streamUrl: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="profile-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        className="profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="profile-drawer-head">
          <div>
            <h2 id="profile-drawer-title" className="profile-drawer-title">
              Your profile
            </h2>
            <p className="profile-drawer-sub">Synced across every signed-in device</p>
          </div>
          <button type="button" className="profile-drawer-close" onClick={onClose} aria-label="Close profile">
            ×
          </button>
        </div>

        <div className="profile-drawer-body">
          <section className="profile-card" aria-labelledby="acct-summary">
            <h3 id="acct-summary" className="profile-section-title">
              Account
            </h3>
            <div className="profile-avatar" aria-hidden>
              {(user.email?.[0] ?? user.uid[0] ?? "?").toUpperCase()}
            </div>
            <p className="profile-email">{user.isAnonymous ? "Guest session" : (user.email ?? "Signed in")}</p>
            <p className="profile-meta">
              {user.isAnonymous
                ? "Create an account to sync across devices."
                : `User ID · ${user.uid.slice(0, 8)}…`}
            </p>
          </section>

          <section className="profile-card" aria-labelledby="fav-heading">
            <div className="profile-section-head">
              <h3 id="fav-heading" className="profile-section-title">
                Favorites
              </h3>
              <span className="profile-badge">{favorites.length}</span>
            </div>
            <p className="profile-hint">Order matches your library; it syncs to your account in Firestore.</p>
            <div className="profile-ch-scroll">
              {favorites.length === 0 ? (
                <p className="profile-device-empty">No favorites yet — use the star on a channel card.</p>
              ) : (
                <ul className="profile-ch-list">
                  {favorites.map((ch) => (
                    <li key={ch.streamUrl} className="profile-ch-row">
                      <div className="profile-ch-logo">
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
                      <span className="profile-ch-name">{ch.name}</span>
                      <button
                        type="button"
                        className="btn-profile-play"
                        disabled={!canPlay}
                        onClick={() => onPlayChannel(ch.streamUrl)}
                      >
                        Play
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="profile-card" aria-labelledby="watched-heading">
            <div className="profile-section-head">
              <h3 id="watched-heading" className="profile-section-title">
                Watched channels
              </h3>
              <span className="profile-badge">{watched.length}</span>
            </div>
            <p className="profile-hint">
              Channels you open are recorded here (up to {MAX_WATCH_HISTORY} unique streams, newest first) and stay in
              sync everywhere you log in.
            </p>
            <div className="profile-ch-scroll">
              {watched.length === 0 ? (
                <p className="profile-device-empty">No history yet — tune in to a channel to build your list.</p>
              ) : (
                <ul className="profile-ch-list">
                  {watched.map((ch) => (
                    <li key={ch.streamUrl} className="profile-ch-row">
                      <div className="profile-ch-logo">
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
                      <div className="profile-ch-info">
                        <span className="profile-ch-name">{ch.name}</span>
                        <span className="profile-ch-when">{formatWatchedAt(ch.lastAt)}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-profile-play"
                        disabled={!canPlay}
                        onClick={() => onPlayChannel(ch.streamUrl)}
                      >
                        Play
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="profile-card" aria-labelledby="devices-heading">
            <div className="profile-section-head">
              <h3 id="devices-heading" className="profile-section-title">
                Devices
              </h3>
              <span className="profile-badge">{devices.length}</span>
            </div>
            <p className="profile-hint">
              Each browser or device you use appears here when you&apos;re signed in. Now playing updates in near real
              time.
            </p>

            <ul className="profile-device-list">
              {devices.length === 0 ? (
                <li className="profile-device-empty">No device sessions yet — they appear within a few seconds.</li>
              ) : (
                devices.map((d) => {
                  const isSelf = d.id === thisDeviceId;
                  return (
                    <li key={d.id} className={`profile-device-row ${isSelf ? "is-self" : ""}`}>
                      <div className="profile-device-main">
                        <div className="profile-device-title">
                          <span className="profile-device-label">{d.label}</span>
                          {isSelf ? <span className="profile-pill">This device</span> : null}
                        </div>
                        <div className="profile-device-meta">
                          <span>{d.platform}</span>
                          <span className="profile-dot">·</span>
                          <span>{formatSeen(d.lastSeen)}</span>
                        </div>
                        {d.playingUrl && d.playingName ? (
                          <div className="profile-now-playing">
                            <span className="profile-np-tag">Now playing</span>
                            <span className="profile-np-name">{d.playingName}</span>
                          </div>
                        ) : (
                          <div className="profile-idle">Idle</div>
                        )}
                      </div>
                      {!isSelf ? (
                        <button
                          type="button"
                          className="btn-profile-remove"
                          onClick={() => onRemoveDevice(d.id)}
                          title="Remove this device from the list"
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
