'use client'

import { useState, useEffect } from 'react'
import VideoPlayer from './components/VideoPlayer'
import './globals.css'

interface Playlist {
  id: string
  name: string
  filename: string
  type?: 'local' | 'remote'
  url?: string | null
}

interface Channel {
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

export default function Home() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedQuality, setSelectedQuality] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load playlists on mount
  useEffect(() => {
    fetch('/api/playlists')
      .then(res => res.json())
      .then(data => {
        setPlaylists(data.playlists)
        if (data.playlists.length > 0) {
          setSelectedPlaylist(data.playlists[0].id)
        }
      })
      .catch(err => {
        console.error('Error loading playlists:', err)
        setError('Failed to load playlists')
      })
  }, [])

  // Load channels when playlist changes
  useEffect(() => {
    if (!selectedPlaylist) return

    setLoading(true)
    setError(null)
    
    // Find the selected playlist to get its URL if it's remote
    const playlist = playlists.find(p => p.id === selectedPlaylist)
    const playlistUrl = playlist?.url
    
    // Build API URL
    const apiUrl = playlistUrl 
      ? `/api/channels?url=${encodeURIComponent(playlistUrl)}`
      : `/api/channels?playlist=${selectedPlaylist}`
    
    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          setChannels([])
        } else {
          setChannels(data.channels)
          setFilteredChannels(data.channels)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading channels:', err)
        setError('Failed to load channels')
        setLoading(false)
      })
  }, [selectedPlaylist, playlists])

  // Filter channels based on search and filters
  useEffect(() => {
    let filtered = [...channels]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(ch =>
        ch.name.toLowerCase().includes(query) ||
        ch.tvgName?.toLowerCase().includes(query) ||
        ch.groupTitle?.toLowerCase().includes(query)
      )
    }

    if (selectedCountry) {
      filtered = filtered.filter(ch =>
        ch.country?.toLowerCase() === selectedCountry.toLowerCase()
      )
    }

    if (selectedQuality) {
      filtered = filtered.filter(ch =>
        ch.quality?.toLowerCase().includes(selectedQuality.toLowerCase())
      )
    }

    setFilteredChannels(filtered)
  }, [searchQuery, selectedCountry, selectedQuality, channels])

  // Get unique countries and qualities for filters
  const countries = Array.from(new Set(channels.map(ch => ch.country).filter(Boolean))).sort()
  const qualities = Array.from(new Set(channels.map(ch => ch.quality).filter(Boolean))).sort()

  const handleChannelClick = (channel: Channel) => {
    setSelectedChannel(channel)
  }

  return (
    <div>
      <header className="header">
        <div className="container">
          <h1>📺 IPTV Player</h1>
        </div>
      </header>

      <main className="container">
        {error && <div className="error">{error}</div>}

        <div className="search-container">
          <select
            className="playlist-select"
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
            style={{ minWidth: '300px' }}
          >
            <optgroup label="🌐 Remote Playlists (iptv-org)">
              {playlists.filter(p => p.type === 'remote' && !p.name.includes('Category:') && !p.name.includes('Country:')).map(playlist => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="📁 Categories">
              {playlists.filter(p => p.name.includes('Category:')).map(playlist => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="🌍 Countries">
              {playlists.filter(p => p.name.includes('Country:')).map(playlist => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="💾 Local Playlists">
              {playlists.filter(p => p.type === 'local' || !p.type).map(playlist => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </optgroup>
          </select>
          
          <button
            onClick={() => {
              // Load streams directly from API
              setLoading(true)
              setError(null)
              fetch('/api/streams?limit=500')
                .then(res => res.json())
                .then(data => {
                  if (data.error) {
                    setError(data.error)
                    setChannels([])
                  } else {
                    // Transform API streams to channel format
                    const transformedChannels = data.streams.map((s: any) => ({
                      id: s.id,
                      name: s.name,
                      url: s.url,
                      tvgId: s.tvgId,
                      tvgName: s.tvgName,
                      tvgLogo: s.tvgLogo,
                      groupTitle: s.groupTitle,
                      quality: s.quality,
                      country: s.country,
                      userAgent: s.userAgent,
                      referrer: s.referrer
                    }))
                    setChannels(transformedChannels)
                    setFilteredChannels(transformedChannels)
                  }
                  setLoading(false)
                })
                .catch(err => {
                  console.error('Error loading streams from API:', err)
                  setError('Failed to load streams from API')
                  setLoading(false)
                })
            }}
            style={{
              padding: '12px 20px',
              background: '#667eea',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            🔄 Load from API
          </button>

          <input
            type="text"
            className="search-input"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="filter-select"
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
          >
            <option value="">All Countries</option>
            {countries.map(country => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={selectedQuality}
            onChange={(e) => setSelectedQuality(e.target.value)}
          >
            <option value="">All Qualities</option>
            {qualities.map(quality => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </select>
        </div>

        <div className="stats">
          <div className="stat-item">
            <div className="stat-label">Total Channels</div>
            <div className="stat-value">{channels.length}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Filtered Results</div>
            <div className="stat-value">{filteredChannels.length}</div>
          </div>
        </div>

        {selectedChannel && (
          <VideoPlayer
            src={selectedChannel.url}
            title={selectedChannel.name}
            quality={selectedChannel.quality}
            groupTitle={selectedChannel.groupTitle}
            userAgent={selectedChannel.userAgent}
            referrer={selectedChannel.referrer}
          />
        )}

        {loading ? (
          <div className="loading">Loading channels...</div>
        ) : (
          <div className="channels-grid">
            {filteredChannels.map(channel => (
              <div
                key={channel.id}
                className={`channel-card ${selectedChannel?.id === channel.id ? 'active' : ''}`}
                onClick={() => handleChannelClick(channel)}
              >
                <div className="channel-name">{channel.name}</div>
                {channel.tvgName && channel.tvgName !== channel.name && (
                  <div className="channel-info">TV: {channel.tvgName}</div>
                )}
                {channel.groupTitle && (
                  <div className="channel-info">Category: {channel.groupTitle}</div>
                )}
                {channel.country && (
                  <div className="channel-info">Country: {channel.country}</div>
                )}
                {channel.quality && (
                  <span className="channel-quality">{channel.quality}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && filteredChannels.length === 0 && (
          <div className="loading">No channels found. Try adjusting your filters.</div>
        )}
      </main>
    </div>
  )
}

