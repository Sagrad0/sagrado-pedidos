'use client'

import { initializeApp, getApps } from 'firebase/app'
import {
  initializeFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

function _getApp() {
  if (!getApps().length) initializeApp(firebaseConfig)
  return getApps()[0]
}

export function getFirebaseApp() {
  return _getApp()
}

// ---- FIRESTORE INSTANCE (sync, cached) ----
let _db: Firestore | null = null

/**
 * Firestore transport tweaks para Safari/iOS (compatível com firebase@10.x):
 * - força long-polling (Safari costuma falhar/engasgar em alguns transports)
 * - mantém auto-detect ligado (não atrapalha e ajuda em redes esquisitas)
 */
const FIRESTORE_SETTINGS = {
  experimentalAutoDetectLongPolling: true,
  experimentalForceLongPolling: true,
} as const

export function getDbInstance(): Firestore {
  if (_db) return _db
  const app = _getApp()
  _db = initializeFirestore(app, FIRESTORE_SETTINGS)
  return _db
}

// ---- AUTH (lazy import) ----
const ENABLE_ANON = (process.env.NEXT_PUBLIC_ENABLE_ANON_AUTH ?? '').toLowerCase() === 'true'

export async function ensureAuthReady() {
  const { getAuth, onAuthStateChanged, signInAnonymously } = await import('firebase/auth')

  const app = _getApp()
  const auth = getAuth(app)

  if (auth.currentUser) return auth

  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub()
      resolve()
    })
  })

  if (!auth.currentUser && ENABLE_ANON) {
    await signInAnonymously(auth)
  }

  return auth
}

// ---- FIRESTORE (lazy import) ----
export async function ensureFirestorePersistence() {
  const db = getDbInstance()

  try {
    await enableIndexedDbPersistence(db)
  } catch {
    // best-effort (multi-tab, private mode etc)
  }

  return db
}
