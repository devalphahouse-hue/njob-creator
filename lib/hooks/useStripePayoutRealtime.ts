'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchPayoutGateState, type PayoutGateState } from '@/lib/supabase/creator'

/**
 * Observa o estado do Stripe Connect do creator em tempo real.
 *
 * O webhook stripe-payouts-webhook escreve em creator_payout_info quando o
 * Stripe envia account.updated. Aqui o front reage instantaneamente:
 * - CreatorLoader libera o app no momento que o Stripe aprova.
 * - /stripe-setup atualiza motivo/pendências sem refresh manual.
 *
 * Mesma fórmula do resto do app: subscribe postgres_changes + polling 5s
 * como rede de segurança contra Realtime quebrado.
 */
export function useStripePayoutRealtime(userId: string | null | undefined) {
  const [gate, setGate] = useState<PayoutGateState | null>(null)
  const [loading, setLoading] = useState<boolean>(!!userId)

  const refresh = useCallback(async () => {
    if (!userId) return null
    const supabase = createClient()
    const next = await fetchPayoutGateState(supabase, userId)
    setGate(next)
    setLoading(false)
    return next
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setGate(null)
      setLoading(false)
      return
    }

    setLoading(true)
    void refresh()

    const supabase = createClient()
    const channel = supabase
      .channel(`payout-info:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'creator_payout_info',
          filter: `creator_id=eq.${userId}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn(`[payout-realtime] ${userId}:`, status)
        }
      })

    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }, 5000)

    return () => {
      window.clearInterval(pollId)
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  return { gate, loading, refresh }
}
