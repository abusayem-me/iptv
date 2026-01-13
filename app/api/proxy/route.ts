import { NextRequest, NextResponse } from 'next/server'

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
      headers['Origin'] = new URL(referrer).origin
    }

    const response = await fetch(url, {
      headers,
      method: 'GET',
      redirect: 'follow',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch stream: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    // Get the content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    
    // For HLS playlists, we need to rewrite URLs in the manifest
    let body = await response.text()
    
    // If it's an HLS manifest, rewrite relative URLs to use our proxy
    if (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegURL') || url.endsWith('.m3u8')) {
      // Rewrite relative URLs to absolute URLs using our proxy
      const baseUrl = new URL(url)
      const proxyBase = `${request.nextUrl.origin}/api/proxy`
      
      // Replace relative URLs with proxied absolute URLs
      body = body.replace(/([^\r\n]+\.(ts|m3u8))/g, (match) => {
        // If it's already an absolute URL, proxy it
        if (match.startsWith('http://') || match.startsWith('https://')) {
          return `${proxyBase}?url=${encodeURIComponent(match)}`
        }
        // If it's relative, make it absolute then proxy it
        try {
          const absoluteUrl = new URL(match, baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1))
          return `${proxyBase}?url=${encodeURIComponent(absoluteUrl.toString())}`
        } catch {
          return match
        }
      })
    }

    // Return the stream with CORS headers
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
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

