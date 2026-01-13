'use client'

import { useEffect, useRef, useState } from 'react'

// Dynamically import HLS.js to avoid SSR issues
let Hls: any = null
if (typeof window !== 'undefined') {
  try {
    Hls = require('hls.js').default
  } catch (e) {
    console.error('Failed to load HLS.js:', e)
  }
}

interface VideoPlayerProps {
  src: string
  title: string
  quality?: string
  groupTitle?: string
  userAgent?: string
  referrer?: string
}

export default function VideoPlayer({ src, title, quality, groupTitle, userAgent, referrer }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [useProxy, setUseProxy] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(src)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = src
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    // Reset proxy flag when src changes
    if (useProxy && src) {
      // Keep proxy flag if we're retrying
    } else {
      setUseProxy(false)
    }
    
    setLoading(true)
    setError(null)

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    // Build the stream URL - always use HLS proxy for .m3u8 files to handle segments
    const buildStreamUrl = (directUrl: string): string => {
      // Always use proxy for HLS streams to handle CORS and segments
      if (directUrl.includes('.m3u8') || useProxy) {
        const params = new URLSearchParams({ url: directUrl })
        if (userAgent) params.set('userAgent', userAgent)
        if (referrer) params.set('referrer', referrer)
        // Use HLS proxy for better segment handling
        return `/api/hls-proxy?${params.toString()}`
      }
      // For non-HLS streams, try direct first, then proxy if needed
      return useProxy ? `/api/hls-proxy?url=${encodeURIComponent(directUrl)}` : directUrl
    }
    
    const streamUrl = buildStreamUrl(src)

    // Check if the browser supports HLS natively (Safari)
    // For Safari, we still use the proxy to handle CORS
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Use proxy URL even for Safari to handle CORS
      const finalUrl = src.includes('.m3u8') ? buildStreamUrl(src) : streamUrl
      video.src = finalUrl
      video.load()
      
      const handleError = () => {
        const error = video.error
        if (error) {
          let errorMsg = 'Failed to load stream'
          switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
              errorMsg = 'Stream loading was aborted'
              break
            case error.MEDIA_ERR_NETWORK:
              errorMsg = 'Network error. The stream may be unavailable.'
              break
            case error.MEDIA_ERR_DECODE:
              errorMsg = 'Decoding error. The stream format may not be supported.'
              break
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMsg = 'Stream format not supported'
              break
          }
          setError(errorMsg)
          console.error('Video error:', error.code, errorMsg)
        }
        setLoading(false)
      }
      
      video.addEventListener('error', handleError)
      video.play().catch((err: Error) => {
        console.error('Error playing video:', err)
        // Check if it's a CORS error
        if (err.message?.includes('CORS') || err.message?.includes('cross-origin')) {
          setError('CORS Error: This stream blocks browser access. Try using VLC or another media player.')
          setLoading(false)
          return
        }
        // Try HLS proxy if direct connection failed
        if (!useProxy) {
          console.log('🔄 Trying HLS proxy as fallback...')
          setUseProxy(true)
          setLoading(true)
          setError(null)
          // This will trigger useEffect to re-run with proxy
          return
        }
        setError('Failed to play stream. The stream may be unavailable, blocked by CORS, or require authentication.')
        setLoading(false)
      })
      
      return () => {
        video.removeEventListener('error', handleError)
      }
    }

    // Use HLS.js for other browsers
    if (Hls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        xhrSetup: (xhr, url) => {
          // Add custom headers if needed
          xhr.setRequestHeader('User-Agent', userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
          xhr.setRequestHeader('Accept', '*/*')
          xhr.setRequestHeader('Accept-Language', 'en-US,en;q=0.9')
          if (referrer) {
            xhr.setRequestHeader('Referer', referrer)
            try {
              const referrerUrl = new URL(referrer)
              xhr.setRequestHeader('Origin', referrerUrl.origin)
            } catch (e) {
              // Ignore invalid referrer URLs
            }
          }
        },
      })

      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed successfully')
        setLoading(false)
        setError(null)
        video.play().catch((err: Error) => {
          console.error('❌ Error playing video:', err)
          // Try proxy if direct connection failed
          if (!useProxy) {
            console.log('🔄 Trying proxy as fallback...')
            setUseProxy(true)
            setLoading(true)
            setError(null)
            // This will trigger useEffect to re-run with proxy
            return
          }
          setError('Failed to play stream. Please try another channel.')
          setLoading(false)
        })
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS Error:', {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          url: data.url,
          error: data.error
        })
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('🔄 Network error, trying to recover...')
              setError('Network error. Trying to recover...')
              setTimeout(() => {
                try {
                  hls.startLoad()
                } catch (e) {
                  console.error('Failed to restart:', e)
                  setError('Failed to recover. Please try another channel.')
                  setLoading(false)
                }
              }, 1000)
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('🔄 Media error, trying to recover...')
              setError('Media error. Trying to recover...')
              try {
                hls.recoverMediaError()
              } catch (e) {
                console.error('Failed to recover media error:', e)
                setError('Failed to recover. Please try another channel.')
                setLoading(false)
              }
              break
            default:
              // Try HLS proxy if direct connection failed
              if (!useProxy && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                console.log('🔄 Trying HLS proxy as fallback...')
                setUseProxy(true)
                setLoading(true)
                setError(null)
                try {
                  hls.destroy()
                } catch (e) {
                  console.error('Error destroying HLS:', e)
                }
                // This will trigger useEffect to re-run with proxy
                return
              }
              console.error('💥 Fatal error, destroying HLS instance')
              setError(`Stream error: ${data.details || data.error?.message || 'Unknown error'}. Please try another channel.`)
              setLoading(false)
              try {
                hls.destroy()
              } catch (e) {
                console.error('Error destroying HLS:', e)
              }
              break
          }
        } else {
          // Non-fatal error, just log it
          console.warn('⚠️ Non-fatal HLS error:', data.details || data.error)
        }
      })


      hlsRef.current = hls
    } else if (Hls) {
      // HLS.js is available but not supported (shouldn't happen in modern browsers)
      setError('HLS is not supported in this browser. Please use Chrome, Firefox, or Safari.')
      setLoading(false)
      video.src = streamUrl
    } else {
      // HLS.js not loaded (SSR or module issue)
      console.error('HLS.js not available')
      setError('Video player not initialized. Please refresh the page.')
      setLoading(false)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src, userAgent, referrer, useProxy])

  return (
    <div className="video-container">
      <div className="video-wrapper">
        {loading && !error && (
          <div className="no-video" style={{ zIndex: 10 }}>
            <div>Loading stream...</div>
          </div>
        )}
        {error && (
          <div className="no-video" style={{ zIndex: 10, color: '#ff6b6b' }}>
            <div style={{ marginBottom: '15px', fontSize: '18px', fontWeight: '600' }}>⚠️ {error}</div>
            <div style={{ fontSize: '14px', color: '#888', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '15px' }}>
                Many IPTV streams have CORS restrictions that prevent them from playing in web browsers.
                These streams are designed for media players like VLC, not browsers.
              </p>
              <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '6px' }}>
                <p style={{ marginBottom: '10px', fontWeight: '600' }}>💡 Recommended Solution:</p>
                <p style={{ margin: 0, marginBottom: '8px' }}>
                  <strong>Use VLC Media Player</strong> (works best for IPTV streams):
                </p>
                <ol style={{ margin: '5px 0 0 0', fontSize: '12px', textAlign: 'left', display: 'inline-block', paddingLeft: '20px' }}>
                  <li>Click <strong>"Copy URL"</strong> button below</li>
                  <li>Open VLC Media Player</li>
                  <li>Go to <strong>Media → Open Network Stream</strong> (Ctrl+N / Cmd+N)</li>
                  <li>Paste the URL and click <strong>Play</strong></li>
                </ol>
                <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#666' }}>
                  Note: Most IPTV streams are designed for media players, not web browsers, due to CORS restrictions.
                </p>
              </div>
              <p style={{ marginBottom: '10px', fontWeight: '600' }}>
                Or try:
              </p>
              <ul style={{ textAlign: 'left', display: 'inline-block', margin: '0', paddingLeft: '20px' }}>
                <li>Different channels (some may have better CORS support)</li>
                <li>Official broadcaster streams (often work better)</li>
                <li>Channels from major CDNs (Akamai, CloudFront)</li>
              </ul>
            </div>
          </div>
        )}
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%' }}
          crossOrigin="anonymous"
          onLoadedData={() => setLoading(false)}
          onError={(e) => {
            const video = e.currentTarget
            const error = video.error
            if (error) {
              let errorMsg = 'Failed to load video stream'
              switch (error.code) {
                case error.MEDIA_ERR_ABORTED:
                  errorMsg = 'Stream loading was aborted'
                  break
                case error.MEDIA_ERR_NETWORK:
                  errorMsg = 'Network error. Check your connection or try another channel.'
                  break
                case error.MEDIA_ERR_DECODE:
                  errorMsg = 'Decoding error. The stream format may not be supported.'
                  break
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  errorMsg = 'Stream format not supported by your browser.'
                  break
              }
              console.error('❌ Video element error:', error.code, errorMsg)
              setError(errorMsg)
            } else {
              console.error('❌ Video error event:', e)
              setError('Failed to load video stream')
            }
            setLoading(false)
          }}
          onLoadStart={() => {
            console.log('📺 Video load started:', src)
            setLoading(true)
          }}
          onCanPlay={() => {
            console.log('✅ Video can play')
            setLoading(false)
            setError(null)
          }}
        />
      </div>
      <div style={{ padding: '20px', background: '#1a1a1a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>{title}</h2>
          <button
            onClick={copyToClipboard}
            style={{
              padding: '8px 16px',
              background: copied ? '#4caf50' : '#667eea',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              if (!copied) e.currentTarget.style.background = '#5568d3'
            }}
            onMouseOut={(e) => {
              if (!copied) e.currentTarget.style.background = '#667eea'
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy URL'}
          </button>
        </div>
        {quality && <span className="channel-quality">{quality}</span>}
        {groupTitle && (
          <div style={{ marginTop: '10px', color: '#888', fontSize: '14px' }}>
            Category: {groupTitle}
          </div>
        )}
        <div style={{ marginTop: '15px', padding: '12px', background: '#0a0a0a', borderRadius: '6px', fontSize: '12px', color: '#aaa', wordBreak: 'break-all' }}>
          <strong style={{ color: '#888' }}>Stream URL:</strong><br />
          {src}
        </div>
      </div>
    </div>
  )
}
