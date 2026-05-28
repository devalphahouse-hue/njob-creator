'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getCreatorInfo, isCreatorStripeReady } from '@/lib/supabase/creator'
import { useStripePayoutRealtime } from '@/lib/hooks/useStripePayoutRealtime'
import { useAppStore } from '@/lib/store/app-store'

const MAX_RETRIES = 3

/**
 * Carrega os dados do creator na store quando há sessão e creator ainda não foi carregado.
 * Pula carregamento para convidados (sem sessão Supabase).
 *
 * Gate do Stripe: usa creator_payout_info.account_details (campos do Stripe
 * — charges_enabled, payouts_enabled, disabled_reason) como única fonte de
 * verdade. Status local 'COMPLETED' não basta. Subscribe em realtime para
 * reagir quando o webhook do Stripe atualizar a conta — aprovação/rejeição
 * refletem na UI sem refresh.
 */
export default function CreatorLoader() {
  const creator = useAppStore((s) => s.creator)
  const isGuest = useAppStore((s) => s.isGuest)
  const setCreator = useAppStore((s) => s.setCreator)
  const loadingRef = useRef(false)
  const router = useRouter()
  const pathname = usePathname()

  const [userId, setUserId] = useState<string | null>(null)
  const { gate } = useStripePayoutRealtime(userId)

  // Carrega o user.id uma vez para iniciar o realtime do payout.
  useEffect(() => {
    if (isGuest) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setUserId(user.id)
    })
  }, [isGuest])

  // Reage ao estado do Stripe em tempo real:
  // - Se o creator está dentro do app e o Stripe foi rejeitado/expirou → manda pra /stripe-setup
  // - Se o creator está em /stripe-setup e o Stripe acabou de aprovar → manda pra /home
  useEffect(() => {
    if (!gate || isGuest) return
    const onSetup = pathname?.startsWith('/stripe-setup')

    if (gate.ready && onSetup) {
      toast.success('Conta Stripe verificada pelo Stripe!')
      router.replace('/home')
      return
    }

    if (!gate.ready && !onSetup) {
      router.replace('/stripe-setup')
      return
    }
  }, [gate, isGuest, pathname, router])

  // Carregamento inicial do CreatorData. Só roda quando o Stripe está realmente
  // liberado (gate.ready) — antes disso o usuário está na /stripe-setup.
  useEffect(() => {
    if (creator != null || isGuest || loadingRef.current) return
    if (!gate || !gate.ready) return

    const onSetup = pathname?.startsWith('/stripe-setup')
    if (onSetup) return

    loadingRef.current = true

    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { loadingRef.current = false; return }

      // Double-check com fonte de verdade do Stripe antes de hidratar o store.
      if (!isCreatorStripeReady(gate.status === 'COMPLETED' ? 'COMPLETED' : null, gate.accountDetails)) {
        router.replace('/stripe-setup')
        return
      }

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const info = await getCreatorInfo(supabase)
          if (info) { setCreator(info); return }
        } catch (err) {
          console.warn(`[CreatorLoader] attempt ${attempt}/${MAX_RETRIES} failed:`, err)
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 500 * attempt))
          }
        }
      }

      toast.error('Não foi possível carregar seus dados. Atualize a página.')
      loadingRef.current = false
    }

    load().catch(() => {
      loadingRef.current = false
    })
  }, [creator, isGuest, gate, pathname, setCreator, router])

  return null
}
