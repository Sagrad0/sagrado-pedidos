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

function _getApp() {
  if (!getApps().length) initializeApp(firebaseConfig)
  return getApps()[0]
}

// Export opcional (ajuda login/logout sem repetir config)
export function getFirebaseApp() {
  return _getApp()
}

// ---- FIRESTORE INSTANCE (sync, cached) ----
let _db: Firestore | null = null

export function getDbInstance(): Firestore {
  if (_db) return _db
  const app = _getApp()
  _db = getFirestore(app)
  return _db
}

// ---- AUTH (lazy import) ----
const ENABLE_ANON = (process.env.NEXT_PUBLIC_ENABLE_ANON_AUTH ?? '').toLowerCase() === 'true'

/**
 * Garante que o Firebase Auth já resolveu o estado inicial.
 * - Se ENABLE_ANON=true: entra como anônimo (apenas se não houver user)
 * - Se ENABLE_ANON=false: NÃO cria sessão anônima (exige login email/senha)
 */
export async function ensureAuthReady() {
  const { getAuth, onAuthStateChanged, signInAnonymously } = await import('firebase/auth')

  const app = _getApp()
  const auth = getAuth(app)

  // se já tem user, ok
  if (auth.currentUser) return auth

  // espera o estado inicial resolver (ponto que evita race condition)
  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub()
      resolve()
    })
  })

  // se ainda não tem user e anon está habilitado, entra anônimo
  if (!auth.currentUser && ENABLE_ANON) {
    await signInAnonymously(auth)
  }

  return auth
}

// ---- FIRESTORE (lazy import) ----
export async function ensureFirestorePersistence() {
  const { getFirestore, enableIndexedDbPersistence } = await import('firebase/firestore')

  const app = _getApp()
  const db = getFirestore(app)

  try {
    await enableIndexedDbPersistence(db)
  } catch {
    // best-effort (multi-tab, private mode etc)
  }

  return db
}
