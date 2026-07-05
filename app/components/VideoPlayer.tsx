"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Hls from "hls.js";

type Props = {
  /** Same-origin proxy URL (fallback, or primary when direct isn't possible). */
  src: string;
  /** Raw stream URL to try first from the viewer's own network (omit when mixed content would block it). */
  directSrc?: string;
  /** Original upstream URL, for copy / external-player actions. */
  rawStreamUrl?: string;
  channelName: string;
  onPlaybackHealth?: (status: "live" | "dead") => void;
};

type Phase = "direct" | "proxy" | "failed";

/** Remember per-host direct-play results for this session so we don't re-probe on every channel. */
function directCacheKey(url: string): string | null {
  try {
    return `sayemtv:direct:${new URL(url).host}`;
  } catch {
    return null;
  }
}

function readDirectCache(url: string): "ok" | "fail" | null {
  const key = directCacheKey(url);
  if (!key) return null;
  try {
    const v = sessionStorage.getItem(key);
    return v === "ok" || v === "fail" ? v : null;
  } catch {
    return null;
  }
}

function writeDirectCache(url: string, result: "ok" | "fail") {
  const key = directCacheKey(url);
  if (!key) return;
  try {
    sessionStorage.setItem(key, result);
  } catch {
    /* ignore */
  }
}

function clearDirectCache(url: string) {
  const key = directCacheKey(url);
  if (!key) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const PROXY_NETWORK_RETRIES = 1;
const DIRECT_WATCHDOG_MS = 10_000;

export function VideoPlayer({ src, directSrc, rawStreamUrl, channelName, onPlaybackHealth }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [inPip, setInPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>(() =>
    directSrc && readDirectCache(directSrc) !== "fail" ? "direct" : "proxy"
  );
  const [copied, setCopied] = useState(false);
  const reportedRef = useRef<"live" | "dead" | null>(null);
  const onPlaybackHealthRef = useRef(onPlaybackHealth);

  useEffect(() => {
    onPlaybackHealthRef.current = onPlaybackHealth;
  }, [onPlaybackHealth]);

  const reportHealth = useCallback((status: "live" | "dead") => {
    if (reportedRef.current === status) return;
    reportedRef.current = status;
    onPlaybackHealthRef.current?.(status);
  }, []);

  const destroy = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    reportedRef.current = null;
    setPhase(directSrc && readDirectCache(directSrc) !== "fail" ? "direct" : "proxy");
  }, [src, directSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || phase === "failed") return;

    const activeSrc = phase === "direct" && directSrc ? directSrc : src;
    if (!activeSrc) return;

    destroy();

    let disposed = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let proxyRetries = 0;

    const clearWatchdog = () => {
      if (watchdog) {
        clearTimeout(watchdog);
        watchdog = null;
      }
    };

    const failCurrentSource = () => {
      if (disposed) return;
      clearWatchdog();
      if (phase === "direct") {
        if (directSrc) writeDirectCache(directSrc, "fail");
        setPhase("proxy");
      } else {
        reportHealth("dead");
        destroy();
        setPhase("failed");
      }
    };

    const onLive = () => {
      clearWatchdog();
      if (phase === "direct" && directSrc) writeDirectCache(directSrc, "ok");
      reportHealth("live");
    };

    const onPlaying = () => onLive();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Fail fast: we manage retries ourselves so fallbacks kick in quickly.
        manifestLoadingMaxRetry: 0,
        manifestLoadingTimeOut: phase === "direct" ? 8000 : 15000,
        levelLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 1,
      });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(activeSrc);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => onLive());
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (phase === "direct") {
              failCurrentSource();
            } else if (proxyRetries < PROXY_NETWORK_RETRIES) {
              proxyRetries += 1;
              // startLoad() can't recover a failed manifest fetch; re-issue loadSource for those.
              if (String(data.details).toLowerCase().startsWith("manifest")) {
                hls.loadSource(activeSrc);
              } else {
                hls.startLoad();
              }
            } else {
              failCurrentSource();
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            failCurrentSource();
            break;
        }
      });

      if (phase === "direct") {
        watchdog = setTimeout(() => {
          if (!disposed && reportedRef.current !== "live") failCurrentSource();
        }, DIRECT_WATCHDOG_MS);
      }
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeSrc;
    }

    video.addEventListener("playing", onPlaying);
    const onVideoError = () => failCurrentSource();
    video.addEventListener("error", onVideoError);

    return () => {
      disposed = true;
      clearWatchdog();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onVideoError);
      const v = videoRef.current;
      if (v && document.pictureInPictureElement === v) {
        document.exitPictureInPicture().catch(() => {});
      }
      destroy();
    };
  }, [src, directSrc, phase, destroy, reportHealth]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || phase === "failed") return;
    v.play().catch(() => {});
  }, [src, phase]);

  const retry = useCallback(() => {
    reportedRef.current = null;
    if (directSrc) clearDirectCache(directSrc);
    setPhase(directSrc ? "direct" : "proxy");
  }, [directSrc]);

  const copyStreamUrl = useCallback(async () => {
    const url = rawStreamUrl ?? directSrc ?? src;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [rawStreamUrl, directSrc, src]);

  /** Picture-in-Picture: browser may auto-pop-out when tab is hidden; manual toggle as fallback. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const canPip =
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document &&
      document.pictureInPictureEnabled !== false &&
      typeof video.requestPictureInPicture === "function";
    setPipSupported(!!canPip);

    const onEnterPip = () => setInPip(true);
    const onLeavePip = () => setInPip(false);
    video.addEventListener("enterpictureinpicture", onEnterPip);
    video.addEventListener("leavepictureinpicture", onLeavePip);

    try {
      const v = video as HTMLVideoElement & { autoPictureInPicture?: boolean };
      if ("autoPictureInPicture" in video) {
        v.autoPictureInPicture = true;
      }
    } catch {
      /* ignore */
    }

    const tryPipWhenHidden = async () => {
      if (!document.hidden) return;
      const el = videoRef.current;
      if (!el || document.pictureInPictureElement === el) return;
      if (el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      try {
        await el.requestPictureInPicture();
      } catch {
        /* Often blocked without prior user gesture — use the PiP button */
      }
    };

    document.addEventListener("visibilitychange", tryPipWhenHidden);

    return () => {
      document.removeEventListener("visibilitychange", tryPipWhenHidden);
      video.removeEventListener("enterpictureinpicture", onEnterPip);
      video.removeEventListener("leavepictureinpicture", onLeavePip);
      try {
        const v = video as HTMLVideoElement & { autoPictureInPicture?: boolean };
        if ("autoPictureInPicture" in video) {
          v.autoPictureInPicture = false;
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled !== false) {
        await video.requestPictureInPicture();
      }
    } catch {
      /* unsupported or denied */
    }
  }, []);

  const externalUrl = rawStreamUrl ?? directSrc ?? src;
  const isHttpOnHttps =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    externalUrl.startsWith("http://");

  return (
    <div className="player-shell">
      {pipSupported && phase !== "failed" ? (
        <button
          type="button"
          className="pip-toggle"
          onClick={togglePip}
          aria-pressed={inPip}
          title={inPip ? "Close picture-in-picture" : "Picture-in-picture (stays on top when you switch tabs)"}
          aria-label={inPip ? "Exit picture-in-picture" : "Enter picture-in-picture"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <rect x="2" y="4" width="14" height="12" rx="1.5" strokeWidth="1.75" />
            <rect x="10" y="10" width="12" height="10" rx="1.5" strokeWidth="1.75" />
          </svg>
          <span className="pip-toggle-text">{inPip ? "Exit PiP" : "PiP"}</span>
        </button>
      ) : null}
      <video
        ref={videoRef}
        className="video-el"
        controls
        playsInline
        autoPlay
        muted={false}
        disablePictureInPicture={false}
        aria-label={`Live stream: ${channelName}`}
      />
      {phase === "failed" ? (
        <div className="player-error-overlay" role="alert">
          <div className="player-error-card">
            <h3 className="player-error-title">Can&apos;t load this stream</h3>
            <p className="player-error-text">
              {isHttpOnHttps ? (
                <>
                  Browsers block plain <code>http://</code> video on secure <code>https://</code> pages — this is a
                  hard security rule, not a &quot;Proceed anyway&quot; warning you can click through.
                  <br />
                  <br />
                  <strong>Use the browser as the player on your BDIX WiFi:</strong> run{" "}
                  <code>npm run dev:lan</code> on your PC, then open{" "}
                  <code>http://&lt;your-pc-ip&gt;:3000</code> (not https) on the same network. Streams play directly,
                  like VLC inside the browser.
                </>
              ) : (
                "The stream didn't respond from your network or through the server. It may be offline right now, or only reachable from certain networks."
              )}
            </p>
            <div className="player-error-actions">
              <button type="button" className="player-error-btn" onClick={retry}>
                Retry
              </button>
              <button type="button" className="player-error-btn" onClick={copyStreamUrl}>
                {copied ? "Copied!" : "Copy stream URL"}
              </button>
              <a className="player-error-btn" href={`vlc://${externalUrl}`}>
                Open in VLC
              </a>
            </div>
            <p className="player-error-hint">
              Paste the URL into VLC / MX Player (Media → Open Network Stream) if the button doesn&apos;t launch it.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
