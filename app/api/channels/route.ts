import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import parser from 'iptv-playlist-parser'

export interface Channel {
  id: string
  name: string
  url: string
  tvgId?: string
  tvgName?: string
  tvgLogo?: string
  groupTitle?: string
  quality?: string
  country?: string
  userAgent?: string
  referrer?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const playlist = searchParams.get('playlist')
    const playlistUrl = searchParams.get('url') // For remote playlists
    const search = searchParams.get('search') || ''
    const country = searchParams.get('country') || ''
    const quality = searchParams.get('quality') || ''

    if (!playlist && !playlistUrl) {
      return NextResponse.json(
        { error: 'Playlist parameter is required' },
        { status: 400 }
      )
    }

    let content: string
    
    // Fetch from remote URL if provided, otherwise use local file
    if (playlistUrl) {
      try {
        const response = await fetch(playlistUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
        if (!response.ok) {
          return NextResponse.json(
            { error: `Failed to fetch playlist: ${response.status} ${response.statusText}` },
            { status: response.status }
          )
        }
        content = await response.text()
      } catch (error) {
        console.error('Error fetching remote playlist:', error)
        return NextResponse.json(
          { error: 'Failed to fetch remote playlist' },
          { status: 500 }
        )
      }
    } else {
      const filePath = join(process.cwd(), 'streams', `${playlist}.m3u`)
      content = await readFile(filePath, 'utf-8')
    }
    
    const parsed = parser.parse(content)

    let channels: Channel[] = parsed.items.map((item, index) => {
      const nameMatch = item.name?.match(/^(.+?)(?:\s*\(([0-9]+[pi])\))?(?:\s*\[(.+?)\])?$/) || []
      const title = nameMatch[1] || item.name || 'Unknown'
      const extractedQuality = nameMatch[2] || ''
      const label = nameMatch[3] || ''

      // Extract country from playlist name (e.g., "us.m3u" -> "us")
      const playlistName = playlist || (playlistUrl ? new URL(playlistUrl).pathname.split('/').pop()?.replace('.m3u', '') || '' : '')
      const countryCode = playlistName.split('_')[0].toUpperCase()

      return {
        id: `${playlist || playlistUrl || 'channel'}-${index}`,
        name: title,
        url: item.url || '',
        tvgId: item.tvg?.id || '',
        tvgName: item.tvg?.name || title,
        tvgLogo: item.tvg?.logo || '',
        groupTitle: item.group?.title || '',
        quality: extractedQuality,
        country: countryCode,
        userAgent: item.http?.['user-agent'] || undefined,
        referrer: item.http?.referrer || undefined
      }
    })

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      channels = channels.filter(ch => 
        ch.name.toLowerCase().includes(searchLower) ||
        ch.tvgName?.toLowerCase().includes(searchLower) ||
        ch.groupTitle?.toLowerCase().includes(searchLower)
      )
    }

    if (country) {
      channels = channels.filter(ch => 
        ch.country?.toLowerCase() === country.toLowerCase()
      )
    }

    if (quality) {
      channels = channels.filter(ch => 
        ch.quality?.toLowerCase().includes(quality.toLowerCase())
      )
    }

    return NextResponse.json({ 
      channels,
      total: channels.length 
    })
  } catch (error) {
    console.error('Error reading channels:', error)
    return NextResponse.json(
      { error: 'Failed to read channels' },
      { status: 500 }
    )
  }
}

