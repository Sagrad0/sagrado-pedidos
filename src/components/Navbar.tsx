'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NavLink = ({ href, label }: { href: string; label: string }) => {
  const pathname = usePathname()
  const active = pathname?.startsWith(href)

  return (
    <Link
      href={href}
      className={
        (active
          ? 'text-gray-900 bg-gray-100'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50') +
        ' px-3 py-2 rounded-md text-sm font-medium'
      }
    >
      {label}
    </Link>
  )
}

const MobileNavLink = ({ href, label }: { href: string; label: string }) => {
  const pathname = usePathname()
  const active = pathname?.startsWith(href)

  return (
    <Link
      href={href}
      className={
        (active
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200') +
        ' px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap'
      }
    >
      {label}
    </Link>
  )
}

export const Navbar: React.FC = () => {
  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top row */}
        <div className="flex items-center justify-between h-16">
          <div className="hidden md:flex space-x-4">
            <NavLink href="/orders" label="Pedidos" />
            <NavLink href="/customers" label="Clientes" />
            <NavLink href="/products" label="Produtos" />
          </div>
          <div className="md:hidden">
            <span className="text-gray-800 font-semibold">Sagrado Pedidos</span>
          </div>
          <div className="hidden md:block">
            {/* espaço para futuras ações no desktop */}
          </div>
        </div>

        {/* Mobile nav (tabs) */}
        <div className="md:hidden pb-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <MobileNavLink href="/orders" label="Pedidos" />
            <MobileNavLink href="/customers" label="Clientes" />
            <MobileNavLink href="/products" label="Produtos" />
          </div>
        </div>
      </div>
    </nav>
  )
}
