'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const QUERY_KEY = ['vw_creator_conversations', 'unread-total'] as const

async function fetchUnreadTotal(): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id
  if (!uid) return 0
  const { data, error } = await supabase
    .from('vw_creator_conversations')
    .select('unread_count')
    .eq('profile_id', uid)
  if (error) return 0
  return (data ?? []).reduce((sum, row) => sum + (row.unread_count ?? 0), 0)
}

/**
 * Lê o total de mensagens não lidas (soma de `unread_count` da view
 * `vw_creator_conversations`). Só LÊ — pode ser chamado em vários componentes
 * (Sidebar + Navbar) que o React Query deduplica pela mesma queryKey.
 * A queryKey começa com `['vw_creator_conversations']`, então as invalidações
 * já existentes (ConversationList e a sala de chat) também atualizam o badge.
 */
export function useUnreadMessagesCount(): number {
  // Sem gate em `creator`: roda sempre dentro do app (a queryFn resolve o
  // usuário via auth.getUser e retorna 0 se não houver). Assim o badge aparece
  // em qualquer página, sem janela de "creator ainda carregando".
  const { data: total = 0 } = useQuery({
    queryKey: QUERY_KEY,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    queryFn: fetchUnreadTotal,
  })
  return total
}

/**
 * Assina o Realtime de novas mensagens (de outra pessoa) e invalida o badge.
 * Deve ser montado UMA única vez (CreatorPresenceShell) para não duplicar canal.
 */
export function useUnreadMessagesRealtime(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id
      if (!uid || !active) return
      channel = supabase
        .channel(`unread-messages-badge-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=neq.${uid}` },
          () => queryClient.invalidateQueries({ queryKey: ['vw_creator_conversations'] }),
        )
        .subscribe()
      if (!active && channel) {
        void supabase.removeChannel(channel)
        channel = null
      }
    })()
    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [queryClient])
}
