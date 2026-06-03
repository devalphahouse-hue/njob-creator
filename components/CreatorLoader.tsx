'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getCreatorInfo } from '@/lib/supabase/creator'
import { useAppStore } from '@/lib/store/app-store'
import { useTranslation } from '@/lib/i18n'

const MAX_RETRIES = 3

/**
 * Carrega os dados do creator na store quando há sessão e creator ainda não foi
 * carregado. Pula carregamento para convidados (sem sessão Supabase).
 *
 * O acesso ao app NÃO depende mais do Stripe: o creator entra normalmente mesmo
 * sem a conta aprovada. As features que tocam Stripe (vender, conteúdo, lives,
 * ficar online) são travadas individualmente via useStripeGateState/useStripeGate,
 * e o status em tempo real + banner ficam no StripeGateProvider.
 */
export default function CreatorLoader() {
  const creator = useAppStore((s) => s.creator)
  const isGuest = useAppStore((s) => s.isGuest)
  const setCreator = useAppStore((s) => s.setCreator)
  const loadingRef = useRef(false)
  const deletionCheckedRef = useRef(false)
  const { t } = useTranslation()

  // Cancelamento automático: se a conta está pendente de exclusão, o login
  // dentro dos 30 dias reativa a conta. Roda uma vez por sessão do app.
  useEffect(() => {
    if (isGuest || deletionCheckedRef.current) return
    deletionCheckedRef.current = true
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) { deletionCheckedRef.current = false; return }
      const { data } = await supabase
        .from('profiles')
        .select('deletion_requested_at, deleted_at')
        .eq('id', user.id)
        .maybeSingle()
      if (data?.deletion_requested_at && !data.deleted_at) {
        const { error } = await supabase.rpc('fn_cancel_account_deletion')
        if (!error) toast.success(t('profile.deleteAccount.canceled'))
      }
    })().catch(() => { /* não crítico */ })
  }, [isGuest, t])

  // Carregamento inicial do CreatorData — sempre que há sessão (independe do Stripe).
  useEffect(() => {
    if (creator != null || isGuest || loadingRef.current) return
    loadingRef.current = true

    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { loadingRef.current = false; return }

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
  }, [creator, isGuest, setCreator])

  return null
}
