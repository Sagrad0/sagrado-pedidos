'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ensureAuthReady } from '@/lib/firebase'

type GateState = {
  loading: boolean
  allowed: boolean
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<GateState>({ loading: true, allowed: false })

  // Libera rotas públicas
  const isPublic = pathname === '/login'

  useEffect(() => {
    if (isPublic) {
      setState({ loading: false, allowed: true })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const auth = await ensureAuthReady()
        const user = auth.currentUser

        const allowed = !!user && !user.isAnonymous
        if (!cancelled) setState({ loading: false, allowed })

        if (!allowed) router.replace('/login')
      } catch {
        if (!cancelled) setState({ loading: false, allowed: false })
        router.replace('/login')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isPublic, pathname, router])

  // Segura render enquanto auth resolve (evita query antes da hora)
  if (state.loading) return null
  if (!state.allowed) return null

  return <>{children}</>
}
