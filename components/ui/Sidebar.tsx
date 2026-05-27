'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/supabase/auth'
import { useRouter } from 'next/navigation'
import { useAppStore, useIsGuest } from '@/lib/store/app-store'
import { useTranslation } from '@/lib/i18n'
import ComingSoonModal from '@/components/ui/ComingSoonModal'
import GuestAuthModal from '@/components/ui/GuestAuthModal'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  comingSoon?: boolean
}

const ContentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
)

const CouponsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </svg>
)

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2z" />
    <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
  </svg>
)

const ScheduleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
)

const ProfileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
)

const SignOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </svg>
)

export default function Sidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const isGuest = useIsGuest()
  const setGuest = useAppStore((s) => s.setGuest)

  const navItems: NavItem[] = [
    { label: t('nav.home'), href: '/home', icon: <HomeIcon /> },
    { label: t('nav.chat'), href: '/chat', icon: <ChatIcon /> },
    { label: t('nav.content'), href: '/content', icon: <ContentIcon /> },
    { label: t('nav.schedule'), href: '/schedule', icon: <ScheduleIcon /> },
    { label: t('nav.coupons'), href: '/subscriptions', icon: <CouponsIcon /> },
    { label: t('nav.profile'), href: '/profile', icon: <ProfileIcon /> },
  ]
  const [comingSoonOpen, setComingSoonOpen] = useState(false)
  const [comingSoonFeature, setComingSoonFeature] = useState('')
  const [guestModalOpen, setGuestModalOpen] = useState(false)

  const handleSignOut = async () => {
    if (isGuest) {
      document.cookie = 'njob-guest=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
      setGuest(false)
    } else {
      await signOut()
    }
    router.push('/login')
  }

  const handleComingSoon = (label: string) => {
    setComingSoonFeature(label)
    setComingSoonOpen(true)
  }

  return (
    <aside
      className="hidden md:flex flex-col w-60 shrink-0 h-full py-6 bg-[var(--color-surface)] border-r border-[var(--color-border)]"
    >
      {/* Logo */}
      <div className="px-6 mb-8">
        <span className="text-xl font-bold text-gradient-primary">njob</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href

          // Convidado: qualquer item abre modal de cadastro
          if (isGuest) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => setGuestModalOpen(true)}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gradient-primary text-white'
                    : 'hover:bg-surface-2 text-[var(--color-muted)]',
                ].join(' ')}
              >
                {item.icon}
                {item.label}
              </button>
            )
          }

          if (item.comingSoon) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleComingSoon(item.label)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-surface-2 text-[var(--color-muted)]"
              >
                {item.icon}
                {item.label}
              </button>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gradient-primary text-white'
                  : 'hover:bg-surface-2 text-[var(--color-muted)]',
              ].join(' ')}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <ComingSoonModal
        open={comingSoonOpen}
        onClose={() => setComingSoonOpen(false)}
        feature={comingSoonFeature}
      />

      <GuestAuthModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        message={t('modals.guestNeedAccount')}
      />

      {/* Sign out */}
      <div className="px-3 mt-4">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors hover:bg-surface-2 text-[var(--color-muted)]"
        >
          <SignOutIcon />
          {t('nav.signOut')}
        </button>
      </div>
    </aside>
  )
}
