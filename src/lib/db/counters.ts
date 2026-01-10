import { getDbInstance, ensureAnonAuth, ensureFirestorePersistence } from '@/lib/firebase'
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'

/**
 * Gera um número incremental de pedido no Firestore.
 * Salva em: counters/orders -> { value: number }
 * Retorna formato: PED-000001
 */
export async function generateOrderId(): Promise<string> {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const ref = doc(db, 'counters', 'orders')

  const nextNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const current = snap.exists() ? Number((snap.data() as any)?.value ?? 0) : 0
    const next = current + 1

    tx.set(
      ref,
      {
        value: next,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )

    return next
  })

  return `PED-${String(nextNumber).padStart(6, '0')}`
}
