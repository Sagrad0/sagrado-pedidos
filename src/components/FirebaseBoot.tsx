'use client'

import { useEffect } from 'react'
import { ensureAuthReady, ensureFirestorePersistence } from '@/lib/firebase'

export function FirebaseBoot() {
  useEffect(() => {
    ;(async () => {
      try {
        await ensureFirestorePersistence()
        await ensureAuthReady()
      } catch {
        // fail silently
      }
    })()
  }, [])

  return null
}
