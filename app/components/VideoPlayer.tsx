"use client";

import { useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";

type Props = {
  src: string;
  channelName: string;
};

export function VideoPlayer({ src, channelName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const destroy = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    destroy();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }

    return destroy;
  }, [src, destroy]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, [src]);

  return (
    <div className="player-shell">
      <video
        ref={videoRef}
        className="video-el"
        controls
        playsInline
        autoPlay
        muted={false}
        aria-label={`Live stream: ${channelName}`}
      />
    </div>
  );
}
