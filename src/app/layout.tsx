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
  icons: {
    icon: [
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1d4ed8" />
      </head>
      <body className={inter.className + " overflow-x-hidden"}>
        <div className="min-h-screen bg-gray-50">
          <FirebaseBoot />
          <Navbar />
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
