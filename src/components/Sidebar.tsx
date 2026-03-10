'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GiChicken, GiBarn, GiFishingBoat } from 'react-icons/gi'
import { MdDashboard, MdOutlineEgg } from 'react-icons/md'
import { FaWheatAwn } from 'react-icons/fa6'
import { clsx } from 'clsx'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: MdDashboard    },
  { href: '/sheds',     label: 'Sheds',     icon: GiBarn         },
  { href: '/ponds',     label: 'Ponds',     icon: GiFishingBoat  },
  { href: '/feed',      label: 'Feed',      icon: FaWheatAwn     },
  { href: '/eggs',      label: 'Eggs',      icon: MdOutlineEgg   },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-100 flex flex-col z-40 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow">
          <GiChicken className="text-white text-xl" />
        </div>
        <div>
          <p className="font-heading font-bold text-gray-900 text-sm leading-tight">MNR Poultry</p>
          <p className="text-xs text-gray-400">Management System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
            )}
          >
            <Icon className="text-lg flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">MNR Poultry © 2026</p>
      </div>
    </aside>
  )
}
