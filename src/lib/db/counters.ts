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

  const ref = doc(db, COLLECTION, id)
  await setDoc(ref, { value })
}

export async function incrementCounter(id: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)

  const current = snap.exists() ? snap.data().value : 0
  await updateDoc(ref, { value: current + 1 })

  return current + 1
}
