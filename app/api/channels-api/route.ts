import { NextResponse } from 'next/server'

/**
 * Fetch channels from iptv-org API with metadata
 * https://iptv-org.github.io/api/channels.json
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const country = searchParams.get('country') || ''
    const category = searchParams.get('category') || ''

    const response = await fetch('https://iptv-org.github.io/api/channels.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch channels from API' },
        { status: response.status }
      )
    }

    let channels: any[] = await response.json()

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      channels = channels.filter(ch =>
        ch.name.toLowerCase().includes(searchLower) ||
        ch.alt_names?.some((name: string) => name.toLowerCase().includes(searchLower))
      )
    }

    if (country) {
      channels = channels.filter(ch =>
        ch.country?.toLowerCase() === country.toLowerCase()
      )
    }

    if (category) {
      channels = channels.filter(ch =>
        ch.categories?.includes(category.toLowerCase())
      )
    }

    return NextResponse.json({
      channels,
      total: channels.length
    })
  } catch (error) {
    console.error('Error fetching channels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    )
  }
}

