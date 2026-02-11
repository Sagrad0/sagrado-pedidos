'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getFirebaseApp } from '@/lib/firebase'
import { getAuth, signOut } from 'firebase/auth'

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname?.startsWith(href)

  return (
    <Link
      href={href}
      className={
        (active
          ? 'bg-slate-900 text-white'
          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100') +
        ' px-4 py-2 rounded-full text-sm font-semibold transition'
      }
    >
      {label}
    </Link>
  )
}

export const Navbar: React.FC = () => {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/login') return null

  async function handleLogout() {
    const app = getFirebaseApp()
    const auth = getAuth(app)
    await signOut(auth)
    router.replace('/login')
  }

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="font-extrabold tracking-tight text-slate-900">Sagrado Pedidos</span>
              <span className="text-xs text-slate-500">uso interno</span>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <NavLink href="/orders" label="Pedidos" />
              <NavLink href="/customers" label="Clientes" />
              <NavLink href="/products" label="Produtos" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              Sair
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden pb-3">
          <div className="tabs">
            <NavLink href="/orders" label="Pedidos" />
            <NavLink href="/customers" label="Clientes" />
            <NavLink href="/products" label="Produtos" />
          </div>
        </div>
      </div>
    </nav>
  )
}
