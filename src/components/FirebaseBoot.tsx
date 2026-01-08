'use client'

import { useEffect } from 'react'
import { ensureAnonAuth, ensureFirestorePersistence } from '@/lib/firebase'

/**
 * Boot Firebase on the client:
 * - enables Firestore offline cache (best-effort)
 * - signs in anonymously (no UI)
 */
export function FirebaseBoot() {
  useEffect(() => {
    ;(async () => {
      try {
        await ensureFirestorePersistence()
        await ensureAnonAuth()
      } catch {
        // fail silently; screens will show errors on CRUD actions if needed
      }
    })()
  }, [])

  return null
}
