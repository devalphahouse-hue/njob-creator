'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsGuest } from '@/lib/store/app-store'
import { useTranslation } from '@/lib/i18n'
import ComingSoonModal from '@/components/ui/ComingSoonModal'
import GuestAuthModal from '@/components/ui/GuestAuthModal'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  comingSoon?: boolean
}

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const ContentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18M9 21V9" />
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

export default function Navbar() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const isGuest = useIsGuest()

  const mobileNav: NavItem[] = [
    { label: t('nav.home'), href: '/home', icon: <HomeIcon /> },
    { label: t('nav.chat'), href: '/chat', icon: <ChatIcon /> },
    { label: t('nav.content'), href: '/content', icon: <ContentIcon /> },
    { label: t('nav.schedule'), href: '/schedule', icon: <ScheduleIcon /> },
    { label: t('nav.profile'), href: '/profile', icon: <ProfileIcon /> },
  ]
  const [comingSoonOpen, setComingSoonOpen] = useState(false)
  const [comingSoonFeature, setComingSoonFeature] = useState('')
  const [guestModalOpen, setGuestModalOpen] = useState(false)

  const handleComingSoon = (label: string) => {
    setComingSoonFeature(label)
    setComingSoonOpen(true)
  }

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 px-2 bg-[var(--color-surface)] border-t border-[var(--color-border)]"
      >
        {mobileNav.map((item) => {
          const isActive = pathname === item.href

          // Convidado: qualquer item abre modal de cadastro
          if (isGuest) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => setGuestModalOpen(true)}
                className={[
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors',
                  isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]',
                ].join(' ')}
              >
                {item.icon}
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 h-0.5 w-8 rounded-full bg-[var(--color-primary)]" />
                )}
              </button>
            )
          }

          if (item.comingSoon) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleComingSoon(item.label)}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-[var(--color-muted)]"
              >
                {item.icon}
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors',
                isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]',
              ].join(' ')}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-0 h-0.5 w-8 rounded-full bg-[var(--color-primary)]" />
              )}
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
    </>
  )
}
