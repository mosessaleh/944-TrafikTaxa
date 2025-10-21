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
        <header className="border-b bg-white shadow-sm">
          <Navbar />
        </header>
        <main className="container py-6 mt-6">{children}</main>
      </body>
    </html>
  )
}
