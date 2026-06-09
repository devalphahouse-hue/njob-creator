'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_CALL_DURATION_MIN,
  getPaidCallWindowMs,
} from '@/lib/constants/call-windows'

export type BusyReason = 'live' | 'call' | null

const AWAITING_WINDOW_MS = 30 * 60 * 1000 // 30min — alinha com fn_expire_pending_calls
// Carência após o fim teórico da chamada, antes de liberar o toggle.
// Pequena para destravar logo que a call encerra (clock skew / fim do timer).
const PAID_GRACE_MS = 2 * 60 * 1000

/**
 * Indica se o creator está "ocupado" e, portanto, não pode ficar offline:
 *   - 'live': há uma live com status='live' do creator;
 *   - 'call': há uma videochamada 1-a-1 EM ANDAMENTO (awaiting_payment recente
 *     ou paid dentro da janela real da chamada — não um flat de 2h).
 *
 * Uma call paga deixa de "ocupar" assim que: (a) muda de status (completed /
 * cancelled — pega via realtime na hora) OU (b) ultrapassa a janela
 * paid_at/actual_start_time + duração + carência (pega via poll, caso o
 * onLeaveRoom não dispare por fechamento de aba). Antes a janela era um flat
 * de 2h a partir de paid_at, então uma chamada de 30min travava o toggle por 2h.
 *
 * Reflete a mesma regra de exclusividade aplicada no backend
 * (fn_create_call_request / fn_validate_call_transition / create-stripe-checkout).
 * Realtime em live_streams + one_on_one_calls, com polling de 5s como fallback.
 */
export function useCreatorBusy(creatorId: string | null | undefined): {
  busy: boolean
  reason: BusyReason
} {
  const [reason, setReason] = useState<BusyReason>(null)

  const check = useCallback(async () => {
    if (!creatorId) {
      setReason(null)
      return
    }
    const supabase = createClient()

    // Live ativa?
    const { data: lives } = await supabase
      .from('live_streams')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('status', 'live')
      .limit(1)
    if (lives && lives.length > 0) {
      setReason('live')
      return
    }

    // Chamada 1-a-1 em andamento (aceita/paga dentro da janela real)?
    const { data: calls } = await supabase
      .from('one_on_one_calls')
      .select(
        'status, paid_at, accepted_at, created_at, actual_start_time, scheduled_duration_minutes'
      )
      .eq('creator_id', creatorId)
      .in('status', ['awaiting_payment', 'paid'])
      .limit(5)

    const now = Date.now()
    const hasActiveCall = (calls ?? []).some((c) => {
      if (c.status === 'paid') {
        // Âncora: começou de fato (actual_start_time) ou, no máximo, paid_at.
        const anchorIso = c.actual_start_time ?? c.paid_at
        if (!anchorIso) return false
        const durationMin =
          c.scheduled_duration_minutes ?? DEFAULT_CALL_DURATION_MIN
        const windowEnd =
          new Date(anchorIso).getTime() +
          getPaidCallWindowMs(durationMin) +
          PAID_GRACE_MS
        return now < windowEnd
      }
      // awaiting_payment — janela de 30min (alinha com fn_expire_pending_calls)
      const ref = c.accepted_at ?? c.created_at
      return !!ref && new Date(ref).getTime() > now - AWAITING_WINDOW_MS
    })
    setReason(hasActiveCall ? 'call' : null)
  }, [creatorId])

  useEffect(() => {
    if (!creatorId) {
      setReason(null)
      return
    }
    void check()

    const supabase = createClient()
    const channel = supabase
      .channel(`creator-busy-${creatorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'one_on_one_calls',
          filter: `creator_id=eq.${creatorId}`,
        },
        () => void check()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_streams',
          filter: `creator_id=eq.${creatorId}`,
        },
        () => void check()
      )
      .subscribe()

    // Fallback: poll de 5s pega a expiração da janela (sem evento de DB).
    const id = setInterval(() => void check(), 5000)
    return () => {
      clearInterval(id)
      void supabase.removeChannel(channel)
    }
  }, [creatorId, check])

  return { busy: reason !== null, reason }
}
