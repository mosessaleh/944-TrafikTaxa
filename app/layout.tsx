import './globals.css'
import Navbar from '@/components/navbar'
import type { ReactNode } from 'react'

export const metadata = {
  title: '944 Trafik',
  description: 'Taxi booking for 944 Trafik',
}

export default function RootLayout({ children }: { children: ReactNode }){
  return (
    <html lang="en">
      <body>
        {/* Navbar with inner padding handled inside component */}
        <Navbar />
        {/* Bigger top margin + vertical padding for page content */}
        <main className="container py-8 mt-8">{children}</main>
      </body>
    </html>
  )
}
