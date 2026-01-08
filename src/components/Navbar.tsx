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

export const Navbar: React.FC = () => {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <Link href="/orders" className="text-xl font-bold text-gray-900">
                SAGRADO
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-2">
                <NavLink href="/orders" label="Pedidos" />
                <NavLink href="/customers" label="Clientes" />
                <NavLink href="/products" label="Produtos" />
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-xs text-gray-500">
              Offline-first • sem login
            </span>
          </div>
        </div>
      </div>
    </nav>
  )
}
