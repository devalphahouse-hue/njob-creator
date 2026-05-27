import { useEffect, useRef } from 'react'
import type { CreatorData } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook L3: Lazy status cleanup — marca live_streams agendadas que já
 * terminaram como 'finished' via RPC server-side (SECURITY DEFINER).
 * Executa apenas uma vez por montagem do componente.
 */
export function useLiveStreamCleanup(
  creator: CreatorData | null,
  refetch: () => void,
): void {
  const cleanupRanRef = useRef(false)

  useEffect(() => {
    if (cleanupRanRef.current || !creator) return
    cleanupRanRef.current = true
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: affected } = await supabase.rpc('cleanup_expired_live_streams', {
        p_creator_id: user.id,
      })

      if (affected && affected > 0) {
        refetch()
      }
    })()
  }, [creator, refetch])
}
