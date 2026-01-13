# IPTV Web Streaming Solution

## Overview

This web application provides a browser-based interface for browsing and playing IPTV channels from the [iptv-org/iptv](https://github.com/iptv-org/iptv) repository. The solution integrates with the [iptv-org/api](https://github.com/iptv-org/api) and [iptv-org/database](https://github.com/iptv-org/database) repositories for structured data access.

## Architecture

### Data Sources

1. **iptv-org API** (`https://iptv-org.github.io/api/`)
   - `streams.json` - All stream URLs with metadata
   - `channels.json` - Channel information and metadata
   - `categories.json` - Category definitions
   - `countries.json` - Country information
   - `feeds.json` - Feed information

2. **M3U Playlists** (from iptv-org/iptv)
   - Remote playlists from GitHub Pages
   - Local playlists from `streams/` directory

### API Endpoints

#### `/api/playlists`
Returns available playlists (local and remote from iptv-org)

#### `/api/channels`
Parses M3U playlists and returns channel data with filters

#### `/api/streams`
Fetches streams directly from iptv-org API (`streams.json`)

#### `/api/hls-proxy`
Proxies HLS streams to handle:
- CORS restrictions
- HLS manifest rewriting
- Segment URL proxying

#### `/api/test-stream`
Tests if a stream URL is accessible and has CORS support

## Streaming Solution

### The Challenge

Most IPTV streams are designed for media players (VLC, Kodi) and block browser access due to:
- **CORS restrictions** - Streams don't allow cross-origin requests
- **Authentication requirements** - Some streams need specific headers
- **Geographic restrictions** - Some streams are geo-blocked

### Our Solution

1. **HLS Proxy** (`/api/hls-proxy`)
   - Fetches streams server-side (bypasses CORS)
   - Rewrites HLS manifest URLs to route segments through proxy
   - Handles both absolute and relative segment URLs
   - Adds proper CORS headers to responses

2. **Automatic Proxy Usage**
   - Automatically uses proxy for `.m3u8` files
   - Falls back to proxy if direct connection fails
   - Handles User-Agent and Referer headers from M3U metadata

3. **HLS.js Integration**
   - Uses HLS.js for browsers that don't natively support HLS
   - Configures xhrSetup to add custom headers
   - Handles network and media errors with recovery

4. **User Guidance**
   - Clear error messages explaining CORS limitations
   - "Copy URL" button for easy VLC access
   - Instructions for using VLC when streams fail

## How It Works

### Stream Flow

```
User clicks channel
    ↓
VideoPlayer component loads
    ↓
Checks if .m3u8 file
    ↓
Uses /api/hls-proxy?url=...
    ↓
Proxy fetches stream from source
    ↓
If HLS manifest, rewrites segment URLs
    ↓
Returns to browser with CORS headers
    ↓
HLS.js or native player handles playback
```

### HLS Manifest Rewriting

When the proxy receives an HLS manifest, it:
1. Parses the manifest line by line
2. Identifies segment URLs (`.ts` files) and nested playlists (`.m3u8`)
3. Rewrites relative URLs to absolute URLs
4. Routes all URLs through the proxy: `/api/hls-proxy?url=...`
5. Returns the rewritten manifest to the browser

This ensures all segment requests go through the proxy, bypassing CORS.

## Limitations

### What Works

✅ **Browsing channels** - Full support
✅ **Searching and filtering** - Full support  
✅ **Some streams** - Streams with proper CORS headers or CDN support
✅ **HLS streams with proxy** - Better support through proxy

### What Doesn't Work

❌ **Many streams** - Blocked by CORS (this is expected)
❌ **Streams requiring authentication** - May not work
❌ **Geo-blocked streams** - Depends on server location

### Recommended Usage

1. **Use the web app to:**
   - Browse and search channels
   - Find stream URLs
   - Test which streams work

2. **Use VLC for playback:**
   - Click "Copy URL" when stream fails
   - Paste into VLC Media Player
   - Most streams work perfectly in VLC

## Technical Details

### HLS Proxy Implementation

The HLS proxy (`app/api/hls-proxy/route.ts`) handles:

```typescript
// Detects HLS manifests
if (contentType.includes('application/vnd.apple.mpegurl') || 
    url.endsWith('.m3u8') ||
    body.includes('#EXTM3U')) {
  
  // Rewrites URLs in manifest
  body = body.split('\n').map(line => {
    // Routes segments through proxy
    return `${proxyBase}?url=${encodeURIComponent(segmentUrl)}`
  }).join('\n')
}
```

### Video Player Features

- **Automatic proxy detection** - Uses proxy for HLS streams
- **Error recovery** - Tries proxy if direct fails
- **Header support** - Passes User-Agent and Referer from M3U
- **Loading states** - Shows progress and errors
- **Copy URL** - Easy access for VLC

## Deployment

### Vercel Configuration

The `vercel.json` file configures:
- Next.js framework detection
- API route rewrites
- Build commands

### Environment Variables

No environment variables required for basic functionality.

## Future Improvements

1. **Stream testing** - Pre-test streams to identify which work
2. **CORS detection** - Mark streams that work in browsers
3. **Alternative players** - Integrate other web players
4. **Caching** - Cache working streams
5. **User preferences** - Save favorite channels

## References

- [iptv-org/iptv](https://github.com/iptv-org/iptv) - Main IPTV repository
- [iptv-org/api](https://github.com/iptv-org/api) - API documentation
- [iptv-org/database](https://github.com/iptv-org/database) - Channel database
- [HLS.js Documentation](https://github.com/video-dev/hls.js/)

## License

Same as the main IPTV project (MIT/Unlicense).

