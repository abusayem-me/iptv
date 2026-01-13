# IPTV Web Player

A modern web application to browse, search, filter, and play IPTV channels directly in your browser.

## Features

- 📺 Browse channels from all available playlists
- 🔍 Search channels by name, TV guide name, or category
- 🌍 Filter by country and quality
- ▶️ Play streams directly in the browser with HLS support
- 📱 Responsive design for mobile and desktop
- ⚡ Fast and efficient channel loading

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- All M3U playlist files in the `streams/` directory

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Deployment to Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Vercel will automatically detect Next.js and configure the build
4. Deploy!

The application will be available at your Vercel URL.

### Vercel Configuration

The project includes a `vercel.json` file with the necessary configuration. Vercel will:
- Automatically detect Next.js
- Build the application
- Serve the API routes and static files

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── playlists/route.ts    # API endpoint to list all playlists
│   │   └── channels/route.ts     # API endpoint to get channels with filters
│   ├── components/
│   │   └── VideoPlayer.tsx       # HLS video player component
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page with channel browser
├── streams/                      # M3U playlist files
├── next.config.js                # Next.js configuration
├── vercel.json                   # Vercel deployment configuration
└── package.json
```

## API Endpoints

### GET /api/playlists

Returns a list of all available playlists.

Response:
```json
{
  "playlists": [
    {
      "id": "us",
      "name": "US",
      "filename": "us.m3u"
    }
  ]
}
```

### GET /api/channels?playlist={playlistId}&search={query}&country={country}&quality={quality}

Returns channels from a specific playlist with optional filters.

Parameters:
- `playlist` (required): The playlist ID (e.g., "us", "uk")
- `search` (optional): Search query to filter channels
- `country` (optional): Filter by country code
- `quality` (optional): Filter by quality (e.g., "720p", "1080p")

Response:
```json
{
  "channels": [
    {
      "id": "us-0",
      "name": "ABC",
      "url": "http://...",
      "tvgId": "ABC.us@East",
      "quality": "720p",
      "country": "US"
    }
  ],
  "total": 100
}
```

## Browser Support

- Chrome/Edge: Full support with HLS.js
- Firefox: Full support with HLS.js
- Safari: Native HLS support
- Mobile browsers: Full support

## Notes

- Some streams may require CORS headers from the source server
- Not all streams may work due to geographic restrictions or server issues
- The video player uses HLS.js for browsers that don't natively support HLS

## License

Same as the main IPTV project (MIT).

