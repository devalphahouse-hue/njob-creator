'use client'

import { Bell } from 'lucide-react'

import ToggleOnline from '@/components/home/ToggleOnline'
import { useTranslation } from '@/lib/i18n'

interface HomeHeaderProps {
  greeting: string
  avatarUrl: string | null | undefined
  userName: string | null
  isOnline: boolean
  onlineUpdating: boolean
  /** Trava o toggle (não pode ficar offline) — live no ar ou chamada 1-a-1 ativa. */
  onlineLocked?: boolean
  unreadCount: number
  onOnlineChange: (isActive: boolean) => void
  onNotificationsClick: () => void
  onViewProfileClick: () => void
}

export function HomeHeader({
  greeting,
  avatarUrl,
  userName,
  isOnline,
  onlineUpdating,
  onlineLocked = false,
  unreadCount,
  onOnlineChange,
  onNotificationsClick,
  onViewProfileClick,
}: HomeHeaderProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* ─── Header: avatar + nome + toggle ───────────────────────── */}
      <div className="flex flex-row justify-between items-center mb-1.5">
        {/* Esquerda: avatar + nome */}
        <div className="flex flex-row items-center gap-2">
          {/* Avatar circular */}
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--color-surface-2)] shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={userName || 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[var(--color-primary)]">
                {(userName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <span className="text-[var(--color-foreground)] text-base font-semibold">
            {greeting}
          </span>
        </div>

        {/* Direita: label "Online" + toggle + sino */}
        <div className="flex flex-row items-center gap-3">
          <div className="flex flex-row items-center gap-1">
            <span className="text-[var(--color-foreground)] text-sm font-semibold">
              {t('common.online')}
            </span>
            <ToggleOnline
              value={isOnline}
              onChange={onOnlineChange}
              disabled={onlineUpdating || onlineLocked}
            />
          </div>

          {/* Notificações */}
          <button
            onClick={onNotificationsClick}
            className="relative bg-transparent border-none cursor-pointer text-[var(--color-muted)] p-1 flex items-center justify-center"
            aria-label={t('common.notifications')}
          >
            <Bell width={24} height={24} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[18px] h-[18px] rounded-[9px] bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Link "Ver perfil" */}
      <button
        onClick={onViewProfileClick}
        className="bg-transparent border-none cursor-pointer text-[var(--color-primary)] text-xs font-semibold p-0 mb-5 block"
      >
        {t('home.viewProfile')}
      </button>
    </>
  )
}
