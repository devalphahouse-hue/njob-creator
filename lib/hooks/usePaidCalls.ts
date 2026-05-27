'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/database'
import { PAID_CALL_WINDOW_MS } from '@/lib/constants/call-windows'

export type PaidCall = Database['public']['Tables']['one_on_one_calls']['Row'] & {
  user?: { full_name: string | null; avatar_url: string | null } | null
}

/**
 * Retorna as chamadas do creator que foram pagas recentemente e cuja janela
 * de 2h ainda não expirou. Usado pelo CTA "Entrar na sala" que aparece
 * automaticamente na home do creator assim que o cliente paga.
 */
export function usePaidCalls(creatorId: string | null | undefined) {
  const [calls, setCalls] = useState<PaidCall[]>([])

  const fetchNow = useCallback(async () => {
    if (!creatorId) return
    const supabase = createClient()
    const cutoffIso = new Date(Date.now() - PAID_CALL_WINDOW_MS).toISOString()

    const { data } = await supabase
      .from('one_on_one_calls')
      .select('*, user:profiles!one_on_one_calls_user_id_fkey(full_name, avatar_url)')
      .eq('creator_id', creatorId)
      .eq('status', 'paid')
      .gte('paid_at', cutoffIso)
      .order('paid_at', { ascending: false })

    setCalls((data as PaidCall[] | null) ?? [])
  }, [creatorId])

  useEffect(() => {
    if (!creatorId) {
      setCalls([])
      return
    }

    void fetchNow()

    const supabase = createClient()
    const channel = supabase
      .channel(`paid-calls:${creatorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'one_on_one_calls',
          filter: `creator_id=eq.${creatorId}`,
        },
        () => void fetchNow(),
      )
      .subscribe()

    // Polling de segurança (3s) para caso Realtime falhe.
    const pollId = setInterval(() => {
      void fetchNow()
    }, 3000)

    return () => {
      clearInterval(pollId)
      void supabase.removeChannel(channel)
    }
  }, [creatorId, fetchNow])

  return { calls, refetch: fetchNow }
}
