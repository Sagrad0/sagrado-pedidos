import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

function envOk() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId)
}

let _app: ReturnType<typeof initializeApp> | null = null
let _auth: Auth | null = null
let _db: Firestore | null = null

function getApp() {
  if (!envOk()) {
    throw new Error(
      'Firebase env vars missing. Configure NEXT_PUBLIC_FIREBASE_* in .env.local (see .env.local.example).'
    )
  }
  if (_app) return _app
  _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  return _app
}

export function getAuthInstance(): Auth {
  if (_auth) return _auth
  _auth = getAuth(getApp())
  return _auth
}

export function getDbInstance(): Firestore {
  if (_db) return _db
  _db = getFirestore(getApp())
  return _db
}

// Best-effort offline persistence (works in most browsers; can fail in private mode / multiple tabs)
let persistenceEnabled = false
export async function ensureFirestorePersistence(): Promise<void> {
  if (persistenceEnabled) return
  try {
    await enableIndexedDbPersistence(getDbInstance())
  } catch {
    // ignore (Safari private mode, multiple tabs, etc.)
  } finally {
    persistenceEnabled = true
  }
}

let authReady: Promise<void> | null = null
export function ensureAnonAuth(): Promise<void> {
  if (authReady) return authReady

  authReady = new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      getAuthInstance(),
      async (user) => {
        try {
          if (!user) {
            await signInAnonymously(getAuthInstance())
          }
          resolve()
        } catch (e) {
          reject(e)
        } finally {
          unsub()
        }
      },
      reject
    )
  })

  return authReady
}
