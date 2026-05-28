'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchPayoutGateState } from '@/lib/supabase/creator'

/**
 * Cinto de segurança para CTAs que tocam Stripe (ligar online, criar live,
 * habilitar venda de packs/calls, aceitar chamada). Lê creator_payout_info na
 * hora — não confia no store que pode estar stale — e bloqueia se a conta
 * Stripe não está totalmente liberada (charges_enabled && payouts_enabled).
 * Mostra um toast claro e redireciona pra /stripe-setup quando necessário.
 *
 * O gate principal continua sendo o CreatorLoader; este hook é defesa em
 * profundidade para o caso de a conta se deteriorar dentro da sessão.
 */
export function useStripeGate() {
  const router = useRouter()

  const ensureReady = useCallback(async (): Promise<boolean> => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return false
    }
    const gate = await fetchPayoutGateState(supabase, user.id)
    if (gate.ready) return true

    if (gate.status === 'REJECTED') {
      toast.error('Há pendências na sua conta Stripe. Resolva antes de continuar.')
    } else if (gate.status === 'VERIFYING') {
      toast.error('Sua conta Stripe ainda está em análise.')
    } else {
      toast.error('Conclua a configuração do Stripe para usar esta função.')
    }
    router.replace('/stripe-setup')
    return false
  }, [router])

  return { ensureReady }
}
