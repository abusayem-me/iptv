import { NextRequest, NextResponse } from 'next/server'

/**
 * HLS Proxy that handles both manifest and segment requests
 * This is needed because HLS streams require multiple requests for segments
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const userAgent = searchParams.get('userAgent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const referrer = searchParams.get('referrer')

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Validate URL
    let streamUrl: URL
    try {
      streamUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      )
    }

    // Fetch the stream with proper headers
    const headers: HeadersInit = {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    }

    if (referrer) {
      headers['Referer'] = referrer
      try {
        headers['Origin'] = new URL(referrer).origin
      } catch {
        // Ignore invalid referrer
      }
    }

    const response = await fetch(url, {
      headers,
      method: 'GET',
      redirect: 'follow',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    let body = await response.text()

    // If it's an HLS manifest (.m3u8), rewrite URLs to use our proxy
    if (contentType.includes('application/vnd.apple.mpegurl') || 
        contentType.includes('application/x-mpegURL') || 
        url.endsWith('.m3u8') ||
        body.includes('#EXTM3U') ||
        body.includes('#EXTINF')) {
      
      const baseUrl = new URL(url)
      const proxyBase = `${request.nextUrl.origin}/api/hls-proxy`
      
      // Rewrite URLs in the manifest - handle both segment files and nested playlists
      body = body.split('\n').map(line => {
        const trimmedLine = line.trim()
        
        // Skip comments, empty lines, and tags
        if (trimmedLine.startsWith('#') || !trimmedLine) {
          return line
        }
        
        // Handle absolute URLs
        if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
          return line.replace(trimmedLine, `${proxyBase}?url=${encodeURIComponent(trimmedLine)}`)
        }
        
        // Handle relative URLs (segments, nested playlists)
        try {
          // Build absolute URL from relative path
          const pathParts = baseUrl.pathname.split('/')
          pathParts.pop() // Remove filename
          const basePath = pathParts.join('/')
          const absoluteUrl = new URL(trimmedLine, `${baseUrl.origin}${basePath}/`)
          return line.replace(trimmedLine, `${proxyBase}?url=${encodeURIComponent(absoluteUrl.toString())}`)
        } catch (e) {
          // If URL construction fails, return original line
          return line
        }
      }).join('\n')
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('HLS Proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy stream' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

