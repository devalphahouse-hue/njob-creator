'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type BusyReason = 'live' | 'call' | null

const PAID_WINDOW_MS = 2 * 60 * 60 * 1000 // 2h — alinha com generate-zego-token / ActiveCallCTA
const AWAITING_WINDOW_MS = 30 * 60 * 1000 // 30min — alinha com fn_expire_pending_calls

/**
 * Indica se o creator está "ocupado" e, portanto, não pode ficar offline:
 *   - 'live': há uma live com status='live' do creator;
 *   - 'call': há uma videochamada 1-a-1 ativa (awaiting_payment recente ou paid em janela).
 *
 * Reflete a mesma regra de exclusividade aplicada no backend
 * (fn_create_call_request / fn_validate_call_transition / create-stripe-checkout).
 * Faz fetch inicial + polling de 5s (fallback simples, sem realtime).
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

    // Chamada 1-a-1 ativa (aceita/paga dentro da janela)?
    const { data: calls } = await supabase
      .from('one_on_one_calls')
      .select('status, paid_at, accepted_at, created_at')
      .eq('creator_id', creatorId)
      .in('status', ['awaiting_payment', 'paid'])
      .limit(5)

    const now = Date.now()
    const hasActiveCall = (calls ?? []).some((c) => {
      if (c.status === 'paid') {
        return !!c.paid_at && new Date(c.paid_at).getTime() > now - PAID_WINDOW_MS
      }
      // awaiting_payment
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
    const id = setInterval(() => void check(), 5000)
    return () => clearInterval(id)
  }, [creatorId, check])

  return { busy: reason !== null, reason }
}
