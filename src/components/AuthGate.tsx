'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getApps, initializeApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

function getApp() {
  if (!getApps().length) initializeApp(firebaseConfig)
  return getApps()[0]
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { getAuth, onAuthStateChanged } = await import('firebase/auth')
      const auth = getAuth(getApp())

      const unsub = onAuthStateChanged(auth, (user) => {
        const isLoginRoute = pathname?.startsWith('/login')
        const isLogged = !!user && user.isAnonymous === false

        // Se não estiver logado e não for /login -> manda pro login
        if (!isLogged && !isLoginRoute) {
          router.replace('/login')
        }

        // Se estiver logado e estiver no /login -> manda pro app
        if (isLogged && isLoginRoute) {
          router.replace('/orders')
        }

        setReady(true)
      })

      return () => unsub()
    })()
  }, [router, pathname])

  if (!ready) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-gray-500 text-sm">
        Carregando…
      </div>
    )
  }

  return <>{children}</>
}
