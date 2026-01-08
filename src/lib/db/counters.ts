import { OrderCounter } from '@/types'
import { getDbInstance, ensureAnonAuth, ensureFirestorePersistence } from '@/lib/firebase'
import { doc, runTransaction } from 'firebase/firestore'

// Get current yearMonth in format YYYYMM
const getCurrentYearMonth = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}${month}`
}

export const getNextOrderNumber = async (): Promise<string> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const yearMonth = getCurrentYearMonth()
  const db = getDbInstance()
  const counterRef = doc(db, 'meta', `orderCounter_${yearMonth}`)

  const nextSeq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const current = snap.exists() ? (snap.data() as OrderCounter) : null
    const seq = (current?.seq ?? 0) + 1
    tx.set(counterRef, { yearMonth, seq }, { merge: true })
    return seq
  })

  const sequence = String(nextSeq).padStart(4, '0')
  return `SAG-${yearMonth}-${sequence}`
}

export const getOrderCounter = async (): Promise<OrderCounter | null> => {
  // Not used in the UI right now; keep for completeness if needed later.
  return null
}
