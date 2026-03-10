import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: { default: 'MNR పౌల్ట్రీ — నిర్వహణ వ్యవస్థ', template: '%s | MNR పౌల్ట్రీ' },
  description: 'MNR పౌల్ట్రీ కోసం దాణా & గుడ్లు దిగుమతి/ఎగుమతి ట్రాకింగ్ వ్యవస్థ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="te">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
