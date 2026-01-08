import './globals.css'
import { Inter } from 'next/font/google'
import { Navbar } from '@/components/Navbar'
import { FirebaseBoot } from '@/components/FirebaseBoot'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Sagrado Pedidos',
  description: 'Sistema de pedidos interno - SAGRADO',
  manifest: '/manifest.json',
  themeColor: '#1d4ed8',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sagrado Pedidos',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="theme-color" content="#1d4ed8" />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <FirebaseBoot />
          <Navbar />
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
