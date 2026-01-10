'use client'

import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

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

// ---- FIRESTORE INSTANCE (sync, cached) ----
let _db: Firestore | null = null

/**
 * Returns a cached Firestore instance.
 *
 * Note: This module is client-only ("use client"), so this is safe to call
 * from client components and client-side DB helpers.
 */
export function getDbInstance(): Firestore {
  if (_db) return _db
  const app = getApp()
  _db = getFirestore(app)
  return _db
}

// ---- AUTH (lazy import) ----
export async function ensureAnonAuth() {
  const { getAuth, signInAnonymously, onAuthStateChanged } = await import('firebase/auth')

  const app = getApp()
  const auth = getAuth(app)

  // já logado?
  if (auth.currentUser) return auth

  // aguarda estado inicial
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub()
      resolve()
    })
  })

  if (!auth.currentUser) {
    await signInAnonymously(auth)
  }

  return auth
}

// ---- FIRESTORE (lazy import) ----
export async function ensureFirestorePersistence() {
  const { getFirestore, enableIndexedDbPersistence } = await import('firebase/firestore')

  const app = getApp()
  const db = getFirestore(app)

  try {
    await enableIndexedDbPersistence(db)
  } catch {
    // best-effort (multi-tab, private mode etc)
  }

  return db
}
