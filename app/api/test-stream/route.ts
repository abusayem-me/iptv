import { NextRequest, NextResponse } from 'next/server'

/**
 * Test if a stream URL is accessible and returns proper CORS headers
 * This helps identify which streams might work in browsers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    try {
      // Try to fetch the stream with a HEAD request first (lighter)
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      const corsHeaders = {
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
      }

      return NextResponse.json({
        accessible: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        corsHeaders,
        hasCors: !!corsHeaders['Access-Control-Allow-Origin'],
        url
      })
    } catch (error: any) {
      return NextResponse.json({
        accessible: false,
        error: error.message,
        url
      })
    }
  } catch (error) {
    console.error('Test stream error:', error)
    return NextResponse.json(
      { error: 'Failed to test stream' },
      { status: 500 }
    )
  }
}

