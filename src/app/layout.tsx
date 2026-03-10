import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { LangProvider } from '@/lib/lang-context'

export const viewport: Viewport = {
  themeColor:   '#f59e0b',
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title:       { default: 'MNR Poultry', template: '%s | MNR Poultry' },
  description: 'MNR Poultry — Feed, Eggs, Sheds & Pond management system',
  manifest:    '/manifest.json',
  appleWebApp: { capable: true, title: 'MNR Poultry', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mul">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <LangProvider>
          <AuthProvider>{children}</AuthProvider>
        </LangProvider>
      </body>
    </html>
  )
}
