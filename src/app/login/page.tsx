'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getApps, initializeApp } from 'firebase/app'

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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
      const auth = getAuth(getApp())
      await signInWithEmailAndPassword(auth, email.trim(), password)
      router.replace('/orders')
    } catch (err: any) {
      setError(err?.message ?? 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white border rounded-xl shadow-sm p-6">
      <h1 className="text-xl font-semibold text-gray-900">Entrar</h1>
      <p className="text-sm text-gray-600 mt-1">Acesso interno – Sagrado Pedidos</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">E-mail</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="vendas1@..."
            autoComplete="username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-md px-4 py-2 font-semibold"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
