import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'MNR Poultry — Management System', template: '%s | MNR Poultry' },
  description: 'Feed & Egg Import/Export tracking system for MNR Poultry',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
