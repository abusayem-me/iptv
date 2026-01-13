import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const streamsDir = join(process.cwd(), 'streams')
    const files = await readdir(streamsDir)
    const localPlaylists = files
      .filter(file => file.endsWith('.m3u'))
      .map(file => ({
        id: file.replace('.m3u', ''),
        name: file.replace('.m3u', '').replace(/_/g, ' ').toUpperCase(),
        filename: file,
        type: 'local',
        url: null
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Add remote playlist options
    const remotePlaylists = [
      {
        id: 'index',
        name: 'All Channels',
        filename: 'index.m3u',
        type: 'remote',
        url: 'https://iptv-org.github.io/iptv/index.m3u'
      },
      {
        id: 'index-category',
        name: 'All Channels (by Category)',
        filename: 'index.category.m3u',
        type: 'remote',
        url: 'https://iptv-org.github.io/iptv/index.category.m3u'
      },
      {
        id: 'index-language',
        name: 'All Channels (by Language)',
        filename: 'index.language.m3u',
        type: 'remote',
        url: 'https://iptv-org.github.io/iptv/index.language.m3u'
      },
      {
        id: 'index-country',
        name: 'All Channels (by Country)',
        filename: 'index.country.m3u',
        type: 'remote',
        url: 'https://iptv-org.github.io/iptv/index.country.m3u'
      }
    ]

    // Popular categories
    const categories = [
      'animation', 'auto', 'business', 'classic', 'comedy', 'cooking', 'culture',
      'documentary', 'education', 'entertainment', 'family', 'general', 'kids',
      'lifestyle', 'movies', 'music', 'news', 'outdoor', 'public', 'religious',
      'science', 'series', 'shop', 'sports', 'travel', 'weather'
    ].map(cat => ({
      id: `category-${cat}`,
      name: `Category: ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
      filename: `${cat}.m3u`,
      type: 'remote',
      url: `https://iptv-org.github.io/iptv/categories/${cat}.m3u`
    }))

    // Popular countries
    const countries = [
      'us', 'uk', 'ca', 'au', 'de', 'fr', 'es', 'it', 'nl', 'br', 'mx', 'in', 'jp', 'kr', 'cn'
    ].map(code => ({
      id: `country-${code}`,
      name: `Country: ${code.toUpperCase()}`,
      filename: `${code}.m3u`,
      type: 'remote',
      url: `https://iptv-org.github.io/iptv/countries/${code}.m3u`
    }))

    const playlists = [
      ...remotePlaylists,
      ...categories,
      ...countries,
      ...localPlaylists
    ]

    return NextResponse.json({ playlists })
  } catch (error) {
    console.error('Error reading playlists:', error)
    return NextResponse.json(
      { error: 'Failed to read playlists' },
      { status: 500 }
    )
  }
}

