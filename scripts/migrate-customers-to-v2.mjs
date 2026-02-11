/*
  MIGRAÇÃO CONTROLADA — customers -> customers_v2

  Objetivo:
  - Criar/atualizar docs em customers_v2 com MESMO ID do customers
  - Converter endereços para OBJETO (Address) com fallback { raw }
  - Recalcular campo `search` (array-contains) para busca consistente
  - NÃO apagar histórico

  ✅ Flags via env:
  - DRY_RUN=true         (não escreve, só simula)
  - ONLY_MISSING=true    (só cria no v2 se não existir)
  - SRC_CUSTOMERS=customers
  - DST_CUSTOMERS=customers_v2
  - BATCH_SIZE=400       (<=500)

  ✅ Credenciais (um dos dois):
  - GOOGLE_APPLICATION_CREDENTIALS=/path/serviceAccountKey.json
  - ou FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

  ✅ Projeto:
  - FIREBASE_PROJECT_ID=seu-projeto

  Rodar:
    npm i
    FIREBASE_PROJECT_ID=xxx GOOGLE_APPLICATION_CREDENTIALS=... npm run migrate:customers_v2
*/

import admin from 'firebase-admin'

// ------------------------
// Config
// ------------------------
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const SRC = process.env.SRC_CUSTOMERS || 'customers'
const DST = process.env.DST_CUSTOMERS || 'customers_v2'
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true'
const ONLY_MISSING = String(process.env.ONLY_MISSING || '').toLowerCase() === 'true'
const BATCH_SIZE = Math.min(Number(process.env.BATCH_SIZE || 400), 500)

if (!PROJECT_ID) {
  console.error('❌ FIREBASE_PROJECT_ID não informado. Ex: FIREBASE_PROJECT_ID=seu-projeto')
  process.exit(1)
}

function initAdmin() {
  if (admin.apps.length) return

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (saJson) {
    const parsed = JSON.parse(saJson)
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: PROJECT_ID,
    })
    return
  }

  // Usa GOOGLE_APPLICATION_CREDENTIALS / ADC
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  })
}

// ------------------------
// Utils (iguais ao app)
// ------------------------
const normalizeDigits = (v) => String(v || '').replace(/\D+/g, '')

function isAddressObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function toAddressObject(v) {
  if (!v) return undefined
  if (isAddressObject(v)) return v
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return undefined
    return { raw: s }
  }
  return { raw: String(v).trim() }
}

function formatAddress(v) {
  if (!v) return ''
  if (typeof v === 'string') return v.trim()
  if (!isAddressObject(v)) return String(v).trim()

  const raw = String(v.raw || '').trim()
  const parts = [
    v.street,
    v.number ? `nº ${v.number}` : undefined,
    v.complement,
    v.neighborhood,
    v.city,
    v.state,
    v.cep,
  ]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean)

  if (raw) {
    const tail = parts.join(' - ')
    return tail ? `${raw}${tail ? ' | ' + tail : ''}` : raw
  }

  return parts.join(' - ')
}

function buildSearchTokens(doc) {
  const tokens = []
  const push = (v) => {
    if (!v) return
    const s = String(v).trim().toLowerCase()
    if (!s) return
    tokens.push(s)
    const digits = normalizeDigits(s)
    if (digits && digits !== s) tokens.push(digits)
  }

  push(doc.name)
  push(doc.legalName)
  push(doc.phone)
  push(doc.doc)
  push(doc.email)
  push(formatAddress(doc.addressMain))
  push(formatAddress(doc.addressDelivery))
  push(doc.address)

  return Array.from(new Set(tokens))
}

function stripUndefined(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function nowMs() {
  return Date.now()
}

// ------------------------
// Migration
// ------------------------
async function main() {
  initAdmin()
  const db = admin.firestore()

  console.log('--- MIGRAÇÃO customers -> customers_v2 ---')
  console.log({ PROJECT_ID, SRC, DST, DRY_RUN, ONLY_MISSING, BATCH_SIZE })

  const srcRef = db.collection(SRC)
  const dstRef = db.collection(DST)

  let lastDoc = null
  let totalRead = 0
  let totalWritten = 0
  let totalSkipped = 0

  while (true) {
    let q = srcRef.orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE)
    if (lastDoc) q = q.startAfter(lastDoc)

    const snap = await q.get()
    if (snap.empty) break

    totalRead += snap.size

    const batch = db.batch()
    let batchOps = 0

    for (const docSnap of snap.docs) {
      const id = docSnap.id
      const data = docSnap.data() || {}

      // Se ONLY_MISSING, pula quem já existe
      if (ONLY_MISSING) {
        const exists = await dstRef.doc(id).get()
        if (exists.exists) {
          totalSkipped += 1
          continue
        }
      }

      // Normalização de endereço:
      // - addressMain: usa data.addressMain || data.address || ''
      // - addressDelivery: usa data.addressDelivery || data.addressMain || data.address || ''
      const addressMain = toAddressObject(data.addressMain || data.address || '')
      const addressDelivery = toAddressObject(data.addressDelivery || data.addressMain || data.address || '')

      const migrated = stripUndefined({
        ...data,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : nowMs(),
        updatedAt: nowMs(),

        addressMain,
        addressDelivery,

        search: buildSearchTokens({
          ...data,
          addressMain,
          addressDelivery,
        }),

        migrationVersion: 'customers_v2',
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const ref = dstRef.doc(id)

      if (!DRY_RUN) {
        batch.set(ref, migrated, { merge: true })
        batchOps += 1
      }
    }

    if (!DRY_RUN && batchOps > 0) {
      await batch.commit()
      totalWritten += batchOps
    } else if (DRY_RUN) {
      totalWritten += batchOps
    }

    lastDoc = snap.docs[snap.docs.length - 1]

    console.log(
      `Página: read=${snap.size} | written(esta página)=${batchOps} | totalRead=${totalRead} | totalWritten=${totalWritten} | skipped=${totalSkipped}`
    )

    if (snap.size < BATCH_SIZE) break
  }

  console.log('--- FIM ---')
  console.log({ totalRead, totalWritten, totalSkipped, DRY_RUN })

  if (DRY_RUN) console.log('ℹ️ DRY_RUN=true: nenhuma escrita foi feita.')
}

main().catch((err) => {
  console.error('❌ MIGRAÇÃO FALHOU', err)
  process.exit(1)
})
