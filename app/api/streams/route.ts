import { NextResponse } from 'next/server'

/**
 * Fetch streams from iptv-org API
 * This uses the structured JSON API instead of parsing M3U files
 * https://iptv-org.github.io/api/streams.json
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const country = searchParams.get('country') || ''
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '1000')

    // Fetch streams from iptv-org API
    const streamsResponse = await fetch('https://iptv-org.github.io/api/streams.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!streamsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch streams from API' },
        { status: streamsResponse.status }
      )
    }

    const streams: any[] = await streamsResponse.json()

    // Fetch channels for metadata
    let channelsMap = new Map()
    try {
      const channelsResponse = await fetch('https://iptv-org.github.io/api/channels.json', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 3600 }
      })
      if (channelsResponse.ok) {
        const channels: any[] = await channelsResponse.json()
        channels.forEach(ch => {
          channelsMap.set(ch.id, ch)
        })
      }
    } catch (e) {
      console.warn('Failed to load channels metadata:', e)
    }

    // Transform streams to our format
    let processedStreams = streams.map((stream, index) => {
      const [channelId, feedId] = (stream.channel || '').split('@')
      const channel = channelsMap.get(channelId)

      return {
        id: `stream-${index}`,
        name: stream.title || channel?.name || 'Unknown',
        url: stream.url,
        tvgId: stream.channel || '',
        tvgName: channel?.name || stream.title,
        tvgLogo: null, // Can be fetched from logos API if needed
        groupTitle: channel?.categories?.[0] || null,
        quality: stream.quality || null,
        country: channel?.country || null,
        userAgent: stream.user_agent || null,
        referrer: stream.referrer || null,
        channelId: channelId,
        feedId: feedId,
        channelData: channel
      }
    })

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      processedStreams = processedStreams.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.tvgName?.toLowerCase().includes(searchLower) ||
        s.channelData?.alt_names?.some((name: string) => name.toLowerCase().includes(searchLower))
      )
    }

    if (country) {
      processedStreams = processedStreams.filter(s =>
        s.country?.toLowerCase() === country.toLowerCase()
      )
    }

    if (category) {
      processedStreams = processedStreams.filter(s =>
        s.channelData?.categories?.includes(category.toLowerCase())
      )
    }

    // Limit results
    processedStreams = processedStreams.slice(0, limit)

    return NextResponse.json({
      streams: processedStreams,
      total: processedStreams.length
    })
  } catch (error) {
    console.error('Error fetching streams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch streams' },
      { status: 500 }
    )
  }
}

