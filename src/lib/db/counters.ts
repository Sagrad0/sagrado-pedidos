import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { getDbInstance, ensureAuthReady } from '@/lib/firebase'

const COLLECTION = 'counters'

export async function getCounter(id: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)

  if (!snap.exists()) return null
  return snap.data()
}

export async function setCounter(id: string, value: number) {
  await ensureAuthReady()
  const db = getDbInstance()

  await setDoc(doc(db, COLLECTION, id), {
    value: Math.trunc(value),
    updatedAt: Date.now(),
  })
}

export async function incrementCounter(id: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)

  const current = snap.exists() ? Number(snap.data().value ?? 0) : 0
  const next = Math.trunc(current) + 1

  if (!snap.exists()) {
    await setDoc(ref, { value: next, updatedAt: Date.now() })
  } else {
    await updateDoc(ref, { value: next, updatedAt: Date.now() })
  }

  return next
}
