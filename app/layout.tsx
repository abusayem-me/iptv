import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IPTV Player',
  description: 'Browse and watch IPTV channels from around the world',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

