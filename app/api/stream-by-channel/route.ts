import { NextResponse } from 'next/server'

/**
 * Get streams for a specific channel ID
 * Uses iptv-org API to find all streams for a channel
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId parameter is required' },
        { status: 400 }
      )
    }

    // Fetch streams from iptv-org API
    const streamsResponse = await fetch('https://iptv-org.github.io/api/streams.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 3600 }
    })

    if (!streamsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch streams from API' },
        { status: streamsResponse.status }
      )
    }

    const streams: any[] = await streamsResponse.json()

    // Filter streams for this channel
    const channelStreams = streams.filter(stream => {
      const [streamChannelId] = (stream.channel || '').split('@')
      return streamChannelId === channelId
    })

    // Transform to our format
    const processedStreams = channelStreams.map((stream, index) => {
      const [channelId, feedId] = (stream.channel || '').split('@')
      
      return {
        id: `stream-${channelId}-${index}`,
        name: stream.title || channelId,
        url: stream.url,
        tvgId: stream.channel || '',
        quality: stream.quality || null,
        userAgent: stream.user_agent || null,
        referrer: stream.referrer || null,
        feedId: feedId
      }
    })

    return NextResponse.json({
      streams: processedStreams,
      total: processedStreams.length
    })
  } catch (error) {
    console.error('Error fetching channel streams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channel streams' },
      { status: 500 }
    )
  }
}

