'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCreator } from '@/lib/store/app-store'
import type { Database } from '@/lib/types/database'
import { formatTimeLocal, formatDateLocal } from '@/lib/utils/datetime'
import { useTranslation } from '@/lib/i18n'
import { Trash2, Search, X, MessageCircle } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type ConversationRow = Database['public']['Views']['vw_creator_conversations']['Row']

function formatMessageTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  return sameDay ? formatTimeLocal(d) : formatDateLocal(d)
}

export default function ConversationList({ selectedId }: { selectedId?: string }) {
  const supabase = createClient()
  const creator = useCreator()
  const router = useRouter()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ConversationRow | null>(null)

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['vw_creator_conversations', creator?.profile?.username],
    enabled: !!creator,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id
      if (!uid) return []
      const [convRes, partsRes] = await Promise.all([
        supabase
          .from('vw_creator_conversations')
          .select('*')
          .eq('profile_id', uid)
          .order('last_message_created_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('conversation_participants')
          .select('conversation_id, cleared_at')
          .eq('profile_id', uid),
      ])
      if (convRes.error) {
        console.error('[ChatList]', convRes.error)
        return []
      }
      // Esconde conversas "excluídas para mim" sem atividade nova (estilo WhatsApp).
      const clearedMap = new Map<string, string | null>()
      for (const p of (partsRes.data ?? []) as { conversation_id: string; cleared_at: string | null }[]) {
        clearedMap.set(p.conversation_id, p.cleared_at)
      }
      return ((convRes.data ?? []) as ConversationRow[]).filter((c) => {
        const cleared = c.conversation_id ? clearedMap.get(c.conversation_id) : null
        if (!cleared) return true
        return (
          !!c.last_message_created_at &&
          new Date(c.last_message_created_at).getTime() > new Date(cleared).getTime()
        )
      })
    },
    refetchOnWindowFocus: true,
    // Fallback contra Realtime quebrado: refaz a lista a cada 5s.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })

  // Realtime: nova mensagem de outra pessoa → atualiza a lista
  useEffect(() => {
    let active = true
    let channelName = ''
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id
      if (!uid || !active) return
      channelName = `creator-conversations-${uid}`
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=neq.${uid}` },
          () => queryClient.invalidateQueries({ queryKey: ['vw_creator_conversations'] }),
        )
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') {
            console.warn('[creator-conversations]', status)
          }
        })
      if (!active) supabase.removeChannel(channel)
    })()
    return () => {
      active = false
    }
  }, [supabase, queryClient])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => (c.peer_name ?? '').toLowerCase().includes(q))
  }, [conversations, search])

  const openChat = (c: ConversationRow) => {
    router.push(`/chat/${encodeURIComponent(c.conversation_id ?? '')}`)
  }

  // Excluir a conversa só para mim (some da minha lista; o outro mantém).
  const confirmDelete = async () => {
    const convId = pendingDelete?.conversation_id
    setPendingDelete(null)
    if (!convId) return
    const { error } = await supabase.rpc('clear_conversation', { p_conversation_id: convId })
    if (error) {
      console.error('[ChatList] delete', error)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['vw_creator_conversations'] })
    if (selectedId === convId) router.push('/chat')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between px-4 py-4">
          {isSearchOpen ? (
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-1 flex items-center gap-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full px-4 h-10">
                <Search className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder={t('common.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] outline-none"
                />
              </div>
              <button
                onClick={() => { setSearch(''); setIsSearchOpen(false) }}
                className="p-1 text-[var(--color-muted)]"
                aria-label={t('common.cancel')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-[var(--color-foreground)]">{t('chat.title')}</h1>
              <div className="flex items-center gap-2">
                {conversations.length > 0 && (
                  <span className="text-xs bg-[var(--color-surface-2)] text-[var(--color-primary)] px-2.5 py-0.5 rounded-full font-medium">
                    {conversations.length}
                  </span>
                )}
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                  aria-label={t('common.search')}
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-[var(--color-muted)]">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-[var(--color-muted)]" />
            </div>
            <div>
              <p className="text-[var(--color-foreground)] font-medium">{t('chat.noConversations')}</p>
              <p className="text-sm text-[var(--color-muted)] mt-1">{t('chat.emptyMessage')}</p>
            </div>
          </div>
        ) : (
          <ul className="list-none p-0 m-0 divide-y divide-[var(--color-border)]">
            {filtered.map((c) => {
              const active = c.conversation_id === selectedId
              const unread = c.unread_count ?? 0
              return (
                <li
                  key={c.conversation_id ?? c.peer_id ?? ''}
                  className={[
                    'group flex items-stretch',
                    active ? 'bg-[var(--color-surface-2)]' : 'hover:bg-[var(--color-surface-2)]',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => openChat(c)}
                    className="flex-1 min-w-0 flex items-center gap-3 px-4 py-4 cursor-pointer text-left"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--color-surface-2)] shrink-0">
                      {c.peer_avatar_url ? (
                        <img src={c.peer_avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-[var(--color-primary)]">
                          {(c.peer_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-semibold text-sm text-[var(--color-foreground)] truncate">
                          {c.peer_name ?? t('chat.noName')}
                        </span>
                        <span className="text-xs text-[var(--color-muted)] shrink-0 ml-2">
                          {formatMessageTime(c.last_message_created_at)}
                        </span>
                      </div>
                      <p className="m-0 text-[13px] text-[var(--color-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
                        {c.last_message ?? '—'}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="min-w-5 h-5 rounded-[10px] bg-[var(--color-primary)] text-white text-[11px] font-bold flex items-center justify-center px-1 shrink-0">
                        {unread}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(c)}
                    aria-label={t('chat.deleteConversation')}
                    title={t('chat.deleteConversation')}
                    className="shrink-0 px-3 flex items-center justify-center text-[var(--color-muted)] hover:text-red-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={t('chat.deleteConversation')}
        message={t('chat.deleteConfirm')}
        confirmLabel={t('chat.deleteConversation')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
