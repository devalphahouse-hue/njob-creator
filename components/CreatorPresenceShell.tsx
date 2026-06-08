'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCreator } from '@/lib/store/app-store'
import { useCreatorPresence } from '@/lib/hooks/useCreatorPresence'
import { useIdleTimeout } from '@/lib/hooks/useIdleTimeout'
import { useCreatorBusy } from '@/lib/hooks/useCreatorBusy'
import { IncomingCallRequestModal } from '@/components/home/IncomingCallRequestModal'
import { ActiveCallCTA } from '@/components/home/ActiveCallCTA'
import { IDLE_TIMEOUT_MS } from '@/lib/constants/call-windows'

/**
 * Injeta presença online + auto-offline por inatividade + modal de
 * solicitações de videochamada em todas as rotas autenticadas (app group).
 */
export default function CreatorPresenceShell() {
  const creator = useCreator()
  const [userId, setUserId] = useState<string | null>(null)
  const isOnline = Boolean(creator?.profile?.is_available_for_calls)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
    })
  }, [creator])

  useCreatorPresence(userId, isOnline)

  // Enquanto ocupado (live no ar / chamada 1-a-1 ativa), o creator não pode
  // cair offline — nem por inatividade.
  const { busy } = useCreatorBusy(userId)

  const handleIdle = useCallback(async () => {
    if (!userId || !isOnline || busy) return
    const supabase = createClient()
    const nowIso = new Date().toISOString()
    await supabase
      .from('profiles')
      .update({ is_available_for_calls: false })
      .eq('id', userId)
    await supabase
      .from('creator_presence')
      .upsert(
        {
          creator_id: userId,
          online: false,
          source: 'idle',
          last_heartbeat_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'creator_id' },
      )
    // A store será reidratada no próximo fetch — para refletir imediatamente,
    // recarregamos a página atual no segmento home (barato).
    window.dispatchEvent(new CustomEvent('creator-presence-forced-offline'))
  }, [userId, isOnline, busy])

  useIdleTimeout(IDLE_TIMEOUT_MS, isOnline, handleIdle)

  return (
    <>
      <IncomingCallRequestModal />
      <ActiveCallCTA />
    </>
  )
}
