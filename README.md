# TV Stream (Next.js)

Web UI to browse and play the HLS channels exported from `tv1 (1).txt` (TV PRO BD–style HTML). Streams are played through a **same-origin HLS proxy** so the browser can load playlists and segments that would otherwise be blocked by CORS.

## Setup

```bash
npm install
```

If you replace `tv1 (1).txt`, regenerate the JSON:

```bash
npm run parse-channels
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

- `scripts/parse-tv1-channels.mjs` parses `playChannel('…m3u8…', …, 'Name')` blocks and writes `data/channels.json`.
- `GET /api/channels` serves that JSON to the client.
- `GET /api/hls-proxy?url=…` fetches upstream HLS; for `*.m3u8` / `#EXTM3U` bodies it rewrites relative and absolute URLs so child playlists and segments also go through the proxy. Only `http`/`https` URLs are allowed; **private/local IP ranges are blocked** to reduce SSRF risk. Do not expose this proxy to the public internet without stronger controls.

## Notes

- Many stream URLs are **time-limited tokens**; when they expire, refresh the source HTML and run `parse-channels` again.
- Playback depends on third-party origins; some streams may fail for geo, DRM, or server policy reasons.

## Legal

Only use streams you have the right to access. This project is a player shell around data you supply.
