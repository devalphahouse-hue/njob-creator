'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import { useTranslation } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/app-store'
import { CheckCircle, Info, AlertTriangle, XCircle, Bell } from 'lucide-react'

type NotificationType = 'success' | 'info' | 'warning' | 'error'

interface Notification {
  id: string
  title: string | null
  message: string
  type: NotificationType
  is_read: boolean | null
  created_at: string | null
}

type Filter = 'all' | 'unread'

const typeColors: Record<NotificationType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(16,185,129,0.1)', border: '#10b981', icon: '#10b981' },
  info: { bg: 'rgba(101,22,147,0.1)', border: '#651693', icon: '#651693' },
  warning: { bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', icon: '#f59e0b' },
  error: { bg: 'rgba(239,68,68,0.1)', border: '#ef4444', icon: '#ef4444' },
}

const TypeIcon = ({ type, color }: { type: NotificationType; color: string }) => {
  const props = { size: 16, color, strokeWidth: 2 }
  if (type === 'success') return <CheckCircle {...props} />
  if (type === 'warning') return <AlertTriangle {...props} />
  if (type === 'error') return <XCircle {...props} />
  return <Info {...props} />
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}sem`
}

async function fetchNotifications(): Promise<Notification[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, message, type, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as Notification[]
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const creator = useAppStore((s) => s.creator)
  const [filter, setFilter] = useState<Filter>('all')

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', creator?.profile.username],
    queryFn: fetchNotifications,
    enabled: !!creator,
    retry: 2,
    refetchInterval: 30_000,
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const qk = ['notifications', creator?.profile.username]
      await queryClient.cancelQueries({ queryKey: qk })
      const prev = queryClient.getQueryData<Notification[]>(qk)
      queryClient.setQueryData<Notification[]>(qk, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      )
      return { prev }
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(['notifications', creator?.profile.username], context.prev)
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      if (error) throw error
    },
    onMutate: async () => {
      const qk = ['notifications', creator?.profile.username]
      await queryClient.cancelQueries({ queryKey: qk })
      const prev = queryClient.getQueryData<Notification[]>(qk)
      queryClient.setQueryData<Notification[]>(qk, (old) =>
        (old ?? []).map((n) => ({ ...n, is_read: true })),
      )
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['notifications', creator?.profile.username], context.prev)
    },
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const filtered = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications

  // Realtime: nova notificação chega na hora (não espera polling 30s).
  useEffect(() => {
    const supabase = createClient()
    let active = true
    let channelRef: { unsubscribe?: () => unknown } | null = null
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id || !active) return
      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void queryClient.invalidateQueries({ queryKey: ['notifications'] })
          },
        )
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') console.warn('[notifications-realtime]', status)
        })
      channelRef = channel as unknown as { unsubscribe?: () => unknown }
      if (!active) void supabase.removeChannel(channel)
    })()
    return () => {
      active = false
      if (channelRef) {
        void supabase.removeChannel(channelRef as unknown as Parameters<typeof supabase.removeChannel>[0])
      }
    }
  }, [queryClient])

  return (
    <div className="flex flex-col min-h-full bg-[var(--color-background)]">
      <PageHeader title={t('nav.notifications')} />

      {/* Filter tabs + mark all */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex gap-1.5">
          {(['all', 'unread'] as Filter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={[
                'px-4 py-1.5 rounded-full text-[13px] font-semibold border-none cursor-pointer transition-all duration-150',
                filter === tab ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-secondary)] text-[var(--color-muted)]',
              ].join(' ')}
            >
              {tab === 'all' ? 'Todas' : 'Não lidas'}
              {tab === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-white/20 rounded-[10px] px-1.5 py-0.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-xs font-semibold text-[var(--color-primary)] bg-transparent border-none cursor-pointer"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4 border-b border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-full bg-[var(--color-secondary)] shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-3 w-2/5 bg-[var(--color-secondary)] rounded" />
                <div className="h-2.5 w-4/5 bg-[var(--color-secondary)] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-secondary)] flex items-center justify-center mb-4">
            <Bell size={24} color="var(--color-muted)" strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-[var(--color-foreground)] mb-1">
            {filter === 'unread' ? 'Tudo em dia!' : 'Nenhuma notificação'}
          </p>
          <p className="text-[13px] text-[var(--color-muted)] max-w-[280px]">
            {filter === 'unread' ? 'Você leu todas as suas notificações.' : 'Quando houver novidades, elas aparecerão aqui.'}
          </p>
          {filter === 'unread' && (
            <button
              onClick={() => setFilter('all')}
              className="mt-4 text-[13px] font-semibold text-[var(--color-primary)] bg-transparent border-none cursor-pointer"
            >
              Ver todas
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          {filtered.map((n) => {
            const colors = typeColors[n.type] || typeColors.info
            return (
              <button
                key={n.id}
                onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
                disabled={!!n.is_read}
                className="w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-[var(--color-border)] transition-colors duration-150"
                style={{
                  borderLeftWidth: 3,
                  borderLeftStyle: 'solid',
                  borderLeftColor: !n.is_read ? colors.border : 'transparent', /* dynamic value - cannot be Tailwind */
                  background: !n.is_read ? 'rgba(101,22,147,0.04)' : 'transparent', /* dynamic value - cannot be Tailwind */
                  opacity: n.is_read ? 0.6 : 1, /* dynamic value - cannot be Tailwind */
                  cursor: n.is_read ? 'default' : 'pointer', /* dynamic value - cannot be Tailwind */
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: colors.bg }} /* dynamic value - cannot be Tailwind */
                >
                  <TypeIcon type={n.type} color={colors.icon} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-[13px] leading-snug ${n.is_read ? 'font-normal text-[var(--color-muted)]' : 'font-semibold text-[var(--color-foreground)]'}`}
                    >
                      {n.title || n.message}
                    </p>
                    <span className="text-[11px] text-[var(--color-muted)] shrink-0">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.title && n.message && (
                    <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  {!n.is_read && (
                    <p className="mt-1.5 text-[11px] text-[var(--color-primary)] font-semibold">
                      Marcar como lida
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
