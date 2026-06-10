"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { hlsProxyUrl } from "@/lib/hlsProxyUrl";

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

function humanCategory(id: string, title: string): string {
  const t = title.replace(/\s*\([^)]*CHANNEL[^)]*\)\s*/gi, "").trim();
  if (t.length > 2) return t;
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function TVApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Channel | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Payload) => {
        setData(j);
        if (j.channels[0]) setActive(j.channels[0]);
      })
      .catch((e: Error) => setLoadErr(e.message));
  }, []);

  const categoryLabel = useMemo(() => {
    const m = new Map<string, string>();
    data?.categories.forEach((c) => {
      m.set(c.id, humanCategory(c.id, c.title));
    });
    return (id: string) => m.get(id) ?? id;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.channels.filter((ch) => {
      if (cat !== "all" && ch.category !== cat) return false;
      if (!term) return true;
      return ch.name.toLowerCase().includes(term);
    });
  }, [data, cat, q]);

  const proxiedSrc = useMemo(() => {
    if (!active || !origin) return "";
    return hlsProxyUrl(origin, active.streamUrl);
  }, [active, origin]);

  const onPick = useCallback((ch: Channel) => {
    setActive(ch);
    setQ("");
  }, []);

  if (loadErr) {
    return (
      <div className="notice error">
        Could not load channel list ({loadErr}). Ensure <code>data/channels.json</code> exists — run{" "}
        <code>npm run parse-channels</code>.
      </div>
    );
  }

  if (!data) {
    return <div className="notice">Loading channels…</div>;
  }

  return (
    <div className="tv-layout">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1>TV Stream</h1>
            <p className="tagline">HLS channels from your saved list</p>
          </div>
        </div>
        {active && (
          <div className="now-playing" aria-live="polite">
            <span className="np-label">Now playing</span>
            <span className="np-title">{active.name}</span>
          </div>
        )}
      </header>

      <section className="player-section">
        {active && proxiedSrc ? (
          <VideoPlayer key={proxiedSrc} src={proxiedSrc} channelName={active.name} />
        ) : (
          <div className="player-placeholder">Select a channel</div>
        )}
      </section>

      <div className="controls-bar">
        <input
          type="search"
          className="search"
          placeholder="Search channels…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search channels"
        />
        <span className="count-pill">
          {filtered.length} / {data.channels.length}
        </span>
      </div>

      <nav className="cat-nav" aria-label="Categories">
        <button type="button" className={cat === "all" ? "cat active" : "cat"} onClick={() => setCat("all")}>
          All
        </button>
        {data.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={cat === c.id ? "cat active" : "cat"}
            onClick={() => setCat(c.id)}
            title={c.title}
          >
            {categoryLabel(c.id)}
          </button>
        ))}
      </nav>

      <div className="channel-grid">
        {filtered.map((ch, idx) => (
          <button
            key={`${idx}-${ch.category}-${ch.streamUrl}`}
            type="button"
            className={active?.streamUrl === ch.streamUrl ? "ch-card playing" : "ch-card"}
            onClick={() => onPick(ch)}
          >
            <span className="ch-logo-wrap">
              <img src={ch.logoUrl} alt="" className="ch-logo" loading="lazy" decoding="async" />
            </span>
            <span className="ch-name">{ch.name}</span>
            <span className="ch-cat">{categoryLabel(ch.category)}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="empty">No channels match your filters.</p>}
    </div>
  );
}
