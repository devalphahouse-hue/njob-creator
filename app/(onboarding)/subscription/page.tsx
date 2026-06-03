'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { createSubscriptionCheckout } from '@/lib/api/subscription'
import { useTranslation } from '@/lib/i18n'
import Link from 'next/link'
import { toast } from 'sonner'

type PlanRow = {
  id: string
  name: string
  description: string | null
  price_monthly: number
  stripe_price_id: string | null
}

export default function OnboardingSubscriptionPage() {
  const supabase = createClient()
  const router = useRouter()
  const { t } = useTranslation()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription_plans_onboarding'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscription_plans').select('*').eq('is_active', true)
      if (error) return []
      return data ?? []
    },
  })

  const handleAssinar = async (plan: PlanRow) => {
    if (!plan.stripe_price_id) {
      toast.error(t('subscriptions.noPriceConfigured'))
      return
    }
    setLoadingId(plan.id)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) {
        toast.error(t('profile.sessionExpired'))
        return
      }
      const { url, error } = await createSubscriptionCheckout(plan.stripe_price_id, token)
      if (error) {
        toast.error(error)
        return
      }
      if (url) {
        window.open(url, '_blank')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center max-w-[480px] mx-auto p-6">
      <h1 className="text-[22px] font-semibold mb-2">{t('onboarding.choosePlan')}</h1>
      <p className="text-[var(--color-muted)] text-sm mb-6">
        {t('onboarding.firstAccessSubscription')}
      </p>
      {plans.length === 0 ? (
        <div className="p-6 text-center text-[var(--color-muted)]">{t('subscriptions.noPlans')}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {(plans as PlanRow[]).map((p) => (
            <div key={p.id} className="p-5 bg-[var(--color-surface-2)] rounded-xl">
              <div className="font-semibold mb-1">{p.name}</div>
              {p.description && (
                <p className="m-0 mb-2 text-[13px] text-[var(--color-muted)]">{p.description}</p>
              )}
              <div className="text-sm mb-3">R$ {Number(p.price_monthly).toFixed(2)}/mês</div>
              <button
                type="button"
                disabled={!p.stripe_price_id || loadingId === p.id}
                onClick={() => handleAssinar(p)}
                className={[
                  'px-5 py-2.5 rounded-lg border-none bg-[var(--color-primary)] text-white font-semibold text-sm',
                  p.stripe_price_id && loadingId !== p.id ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-60',
                ].join(' ')}
              >
                {loadingId === p.id ? t('subscriptions.openingCheckout') : t('subscriptions.subscribe')}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6">
        <Link href="/home" className="text-sm text-[var(--color-primary)] font-semibold">
          {t('onboarding.skipToApp')}
        </Link>
      </div>
    </div>
  )
}
