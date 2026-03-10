'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { GiChicken, GiBarn, GiFishingBoat } from 'react-icons/gi'
import { MdDashboard, MdOutlineEgg, MdLogout, MdLanguage } from 'react-icons/md'
import { FaWheatAwn } from 'react-icons/fa6'
import { clsx } from 'clsx'
import { useAuth } from '@/lib/auth-context'
import { useLang } from '@/lib/lang-context'

export default function Sidebar() {
  const pathname    = usePathname()
  const router      = useRouter()
  const { logout, user } = useAuth()
  const { t, lang, toggleLang } = useLang()

  const navItems = [
    { href: '/dashboard', label: t.nav.dashboard, icon: MdDashboard    },
    { href: '/sheds',     label: t.nav.sheds,     icon: GiBarn         },
    { href: '/ponds',     label: t.nav.ponds,     icon: GiFishingBoat  },
    { href: '/feed',      label: t.nav.feed,      icon: FaWheatAwn     },
    { href: '/eggs',      label: t.nav.eggs,      icon: MdOutlineEgg   },
  ]

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-100 flex flex-col z-40 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow">
          <GiChicken className="text-white text-xl" />
        </div>
        <div>
          <p className="font-heading font-bold text-gray-900 text-sm leading-tight">{t.appName}</p>
          <p className="text-xs text-gray-400">{t.appTagline}</p>
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

      {/* Language Toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={toggleLang}
          className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition-all"
          title="Toggle language"
        >
          <span className="flex items-center gap-2 text-gray-500">
            <MdLanguage className="text-base" />
            {lang === 'te' ? 'తెలుగు' : 'English'}
          </span>
          <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-lg">
            {lang === 'te' ? 'EN' : 'తె'}
          </span>
        </button>
      </div>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-2">
        {user?.email && (
          <p className="text-xs text-gray-400 truncate px-1">{user.email}</p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
        >
          <MdLogout className="text-lg" />
          {t.auth.logout}
        </button>
        <p className="text-xs text-gray-300 px-1">{t.appName} © 2026</p>
      </div>
    </aside>
  )
}
