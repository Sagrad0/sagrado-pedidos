import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  initializeFirestore,
  getFirestore,
  enableIndexedDbPersistence,
  Firestore
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
}

// Evita múltiplas inicializações (crítico no iOS)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

const auth = getAuth(app)

// Cache da instância do Firestore
let _db: Firestore | null = null

export function getDbInstance() {
  if (_db) return _db

  _db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
  })

  return _db
}

const db = getDbInstance()

export async function ensureFirestorePersistence() {
  try {
    await enableIndexedDbPersistence(db)
  } catch (err: any) {
    // Falha comum no iOS / múltiplas abas
    if (
      err.code === 'failed-precondition' ||
      err.code === 'unimplemented'
    ) {
      console.warn('Firestore persistence not enabled:', err.code)
    } else {
      console.error('Firestore persistence error:', err)
    }
  }
}

export { app, auth, db }
