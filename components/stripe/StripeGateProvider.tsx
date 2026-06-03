'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, Clock, CreditCard, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useStripePayoutRealtime } from '@/lib/hooks/useStripePayoutRealtime'
import { useAppStore } from '@/lib/store/app-store'
import type { PayoutGateState } from '@/lib/supabase/creator'

interface StripeGateValue {
  /** true só quando o Stripe está 100% liberado (charges + payouts). */
  ready: boolean
  /** ainda buscando o estado pela primeira vez. */
  loading: boolean
  status: PayoutGateState['status'] | 'UNKNOWN'
  reason: string | null
}

const StripeGateContext = createContext<StripeGateValue>({
  ready: false,
  loading: true,
  status: 'UNKNOWN',
  reason: null,
})

/**
 * Estado do Stripe Connect para gatear features no app do creator.
 * `ready` = pode vender/criar conteúdo/lives/ficar online. Enquanto carrega,
 * `ready` é false (não liberamos ação antes de confirmar) e `loading` é true.
 */
export function useStripeGateState(): StripeGateValue {
  return useContext(StripeGateContext)
}

function BannerCopy(status: StripeGateValue['status'], reason: string | null) {
  switch (status) {
    case 'REJECTED':
      return {
        tone: 'error' as const,
        icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
        text: reason
          ? `Há uma pendência na sua conta Stripe (${reason}). Resolva para liberar vendas, conteúdo, lives e chamadas.`
          : 'Há uma pendência na sua conta Stripe. Resolva para liberar vendas, conteúdo, lives e chamadas.',
        cta: 'Resolver',
      }
    case 'VERIFYING':
      return {
        tone: 'warning' as const,
        icon: <Clock className="w-4 h-4 shrink-0" />,
        text: 'Sua conta Stripe está em análise. Algumas funções ficam bloqueadas até a aprovação — avisaremos aqui quando liberar.',
        cta: 'Ver status',
      }
    default:
      return {
        tone: 'info' as const,
        icon: <CreditCard className="w-4 h-4 shrink-0" />,
        text: 'Configure seus pagamentos no Stripe para liberar a criação de conteúdo, pacotes, lives e chamadas.',
        cta: 'Configurar',
      }
  }
}

const TONE_CLASS: Record<'error' | 'warning' | 'info', string> = {
  error: 'bg-[var(--color-error,#e53e3e)]/12 text-[var(--color-error,#e53e3e)] border-[var(--color-error,#e53e3e)]/30',
  warning: 'bg-[var(--color-warning,#f59e0b)]/12 text-[var(--color-warning,#f59e0b)] border-[var(--color-warning,#f59e0b)]/30',
  info: 'bg-[var(--color-primary)]/12 text-[var(--color-primary)] border-[var(--color-primary)]/30',
}

export default function StripeGateProvider({ children }: { children: React.ReactNode }) {
  const isGuest = useAppStore((s) => s.isGuest)
  const [userId, setUserId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const prevStatusRef = useRef<StripeGateValue['status'] | null>(null)

  useEffect(() => {
    if (isGuest) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setUserId(user.id)
    })
  }, [isGuest])

  const { gate, loading } = useStripePayoutRealtime(userId)

  const ready = gate?.ready === true
  const status: StripeGateValue['status'] = gate?.status ?? 'UNKNOWN'
  const reason = gate?.reason ?? null

  // Toast quando o estado muda durante a sessão (a notificação persistente no
  // sininho é criada pelo trigger fn_notify_stripe_status_change no banco).
  useEffect(() => {
    if (!gate) return
    const prev = prevStatusRef.current
    if (prev !== null && prev !== gate.status) {
      if (gate.status === 'COMPLETED') {
        toast.success('Conta Stripe aprovada! Suas funções foram liberadas.')
      } else if (gate.status === 'REJECTED') {
        toast.error('Há uma nova pendência na sua conta Stripe.')
      } else if (gate.status === 'VERIFYING') {
        toast.info('Sua conta Stripe entrou em análise.')
      }
      setDismissed(false)
    }
    prevStatusRef.current = gate.status
  }, [gate])

  const showBanner = !isGuest && !loading && gate != null && !ready && !dismissed
  const copy = BannerCopy(status, reason)

  return (
    <StripeGateContext.Provider value={{ ready, loading, status, reason }}>
      {showBanner && (
        <div
          className={`flex items-center gap-3 mb-4 px-4 py-3 rounded-xl border text-sm ${TONE_CLASS[copy.tone]}`}
          role="status"
        >
          {copy.icon}
          <span className="flex-1 leading-snug">{copy.text}</span>
          <Link
            href="/stripe-setup"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold no-underline hover:opacity-90"
          >
            {copy.cta}
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Fechar"
            className="shrink-0 p-1 rounded-md hover:bg-black/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {children}
    </StripeGateContext.Provider>
  )
}
