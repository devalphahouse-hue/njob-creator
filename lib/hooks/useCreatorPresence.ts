'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const HEARTBEAT_INTERVAL_MS = 60_000

/**
 * Mantém presença do creator via Supabase Realtime Presence.
 *
 * IMPORTANTE: o desligamento de online (creator_presence.online=false) NÃO é
 * feito no cleanup do useEffect. Em dev o React Strict Mode faz
 * setup→cleanup→setup na montagem, e o Fast Refresh remonta a cada save —
 * ambos disparariam o cleanup e marcariam o creator offline por engano
 * (era o bug "online não reflete no client"). Por isso o offline só é gravado
 * no fechamento REAL da aba (pagehide/beforeunload), que não é disparado por
 * Strict Mode nem Fast Refresh. Os caminhos explícitos de offline (toggle
 * manual, logout e idle de 15min) seguem gravando normalmente em outros pontos.
 *
 * Faz heartbeat a cada 60s atualizando last_heartbeat_at.
 * Só roda enquanto `isOnline` for true.
 */
export function useCreatorPresence(userId: string | null | undefined, isOnline: boolean) {
  const offlineGuardRef = useRef(false)

  useEffect(() => {
    if (!userId || !isOnline) return

    const supabase = createClient()
    const channel = supabase.channel(`presence:creator:${userId}`, {
      config: { presence: { key: userId } },
    })

    offlineGuardRef.current = false

    channel
      .on('presence', { event: 'sync' }, () => {
        // noop — só mantemos o canal vivo pra detectar disconnect.
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    const heartbeat = setInterval(() => {
      const nowIso = new Date().toISOString()
      supabase
        .from('creator_presence')
        .update({ last_heartbeat_at: nowIso, updated_at: nowIso })
        .eq('creator_id', userId)
        .then(() => {})
    }, HEARTBEAT_INTERVAL_MS)

    // Grava offline — APENAS no fechamento real da aba. Best-effort.
    const writeOffline = async () => {
      if (offlineGuardRef.current) return
      offlineGuardRef.current = true
      const nowIso = new Date().toISOString()
      await supabase
        .from('creator_presence')
        .upsert(
          {
            creator_id: userId,
            online: false,
            source: 'presence',
            last_heartbeat_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'creator_id' },
        )
      await supabase
        .from('profiles')
        .update({ is_available_for_calls: false })
        .eq('id', userId)
    }

    const handleUnload = () => {
      void writeOffline()
    }

    window.addEventListener('pagehide', handleUnload)
    window.addEventListener('beforeunload', handleUnload)

    // Cleanup do React (unmount, troca de deps, Strict Mode, Fast Refresh):
    // libera o canal e o heartbeat, mas NÃO marca offline.
    return () => {
      window.removeEventListener('pagehide', handleUnload)
      window.removeEventListener('beforeunload', handleUnload)
      clearInterval(heartbeat)
      void channel.untrack().catch(() => {})
      void supabase.removeChannel(channel).catch(() => {})
    }
  }, [userId, isOnline])
}
