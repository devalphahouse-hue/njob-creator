'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/database'
import { getPaidCallWindowMs } from '@/lib/constants/call-windows'

// Máximo possível de duração no fluxo on-demand (30min ou 60min).
const MAX_PAID_WINDOW_MS = 60 * 60 * 1000

export type PaidCall = Database['public']['Tables']['one_on_one_calls']['Row'] & {
  user?: { full_name: string | null; avatar_url: string | null } | null
}

/**
 * Retorna as chamadas do creator que foram pagas recentemente e cuja janela
 * (= duração comprada, 30min ou 60min) ainda não expirou. Usado pelo CTA
 * "Entrar na sala" que aparece automaticamente na home do creator.
 */
export function usePaidCalls(creatorId: string | null | undefined) {
  const [calls, setCalls] = useState<PaidCall[]>([])

  const fetchNow = useCallback(async () => {
    if (!creatorId) return
    const supabase = createClient()
    // Fetch tudo do último 1h (máx possível); filtro fino por duração no client.
    const cutoffIso = new Date(Date.now() - MAX_PAID_WINDOW_MS).toISOString()

    const { data } = await supabase
      .from('one_on_one_calls')
      .select('*, user:profiles!one_on_one_calls_user_id_fkey(full_name, avatar_url)')
      .eq('creator_id', creatorId)
      .eq('status', 'paid')
      .gte('paid_at', cutoffIso)
      .order('paid_at', { ascending: false })

    const now = Date.now()
    const inWindow = ((data as PaidCall[] | null) ?? []).filter((c) => {
      if (!c.paid_at) return false
      const paidMs = new Date(c.paid_at).getTime()
      const duration = c.scheduled_duration_minutes ?? 60
      return now <= paidMs + getPaidCallWindowMs(duration)
    })
    setCalls(inWindow)
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
