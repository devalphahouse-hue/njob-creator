'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createStripeAccount } from '@/lib/supabase/creator'
import { useStripePayoutRealtime } from '@/lib/hooks/useStripePayoutRealtime'
import { useTranslation } from '@/lib/i18n'

// ─── Humanização dos campos do Stripe (não inventa nada — só traduz) ────────

// Stripe requirements (campos pendentes).
const STRIPE_REQUIREMENT_LABELS: Record<string, string> = {
  'business_profile.url': 'URL do site/negócio',
  'business_profile.mcc': 'Categoria do negócio',
  'business_profile.product_description': 'Descrição do produto',
  'business_type': 'Tipo de negócio',
  'external_account': 'Conta bancária para recebimento',
  'individual.address.city': 'Endereço — cidade',
  'individual.address.line1': 'Endereço — logradouro',
  'individual.address.postal_code': 'Endereço — CEP',
  'individual.address.state': 'Endereço — estado',
  'individual.dob.day': 'Data de nascimento — dia',
  'individual.dob.month': 'Data de nascimento — mês',
  'individual.dob.year': 'Data de nascimento — ano',
  'individual.email': 'E-mail',
  'individual.first_name': 'Nome',
  'individual.id_number': 'CPF',
  'individual.last_name': 'Sobrenome',
  'individual.phone': 'Telefone',
  'individual.verification.document': 'Documento de identidade (foto)',
  'individual.verification.additional_document': 'Documento adicional',
  'tos_acceptance.date': 'Aceite dos termos de uso',
  'tos_acceptance.ip': 'Aceite dos termos de uso',
}

// disabled_reason do Stripe (https://stripe.com/docs/connect/account-capabilities)
const STRIPE_DISABLED_REASON_LABELS: Record<string, string> = {
  'requirements.past_due': 'Alguns documentos não foram enviados no prazo.',
  'requirements.pending_verification': 'O Stripe está verificando seus documentos.',
  'rejected.fraud': 'Conta recusada pelo Stripe por suspeita de fraude.',
  'rejected.terms_of_service': 'Conta recusada por descumprimento dos termos.',
  'rejected.listed': 'Conta recusada — você consta em lista restritiva.',
  'rejected.other': 'Conta recusada pelo Stripe.',
  'listed': 'Conta sob revisão por aparecer em lista restritiva.',
  'under_review': 'Sua conta está em revisão pelo Stripe.',
  'other': 'O Stripe identificou pendências na sua conta.',
}

// Reasons em que o Stripe está validando e o creator NÃO precisa fazer nada —
// só aguardar o resultado. Distinguir desses casos dos reasons que exigem ação
// (past_due, rejected.*, listed, etc.) muda completamente o copy e os botões.
const STRIPE_WAIT_REASONS = new Set([
  'requirements.pending_verification',
  'under_review',
  'listed',
])

function humanizeRequirement(key: string): string {
  return STRIPE_REQUIREMENT_LABELS[key] ?? key.replace(/_/g, ' ')
}

function humanizeReason(reason: string | null): string {
  if (!reason) return ''
  return STRIPE_DISABLED_REASON_LABELS[reason] ?? `Motivo do Stripe: ${reason}`
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'agora há pouco'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `há ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs} h`
  const days = Math.floor(hrs / 24)
  return `há ${days} d`
}

// ─── Page ───────────────────────────────────────────────────────────────────

function StripeSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  const [userId, setUserId] = useState<string | null>(null)
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(searchParams.get('url'))
  const [syncing, setSyncing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)

  // Realtime do creator_payout_info — qualquer mudança feita pelo webhook do
  // Stripe ou pela edge function reflete aqui na hora.
  const { gate, loading } = useStripePayoutRealtime(userId)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
        return
      }
      setUserId(user.id)
    })
  }, [router])

  // Força o Stripe a devolver o estado atual da conta (stripe.accounts.retrieve).
  // O webhook account.updated dá conta da maioria dos casos, mas garantir um
  // pull explícito ao montar evita estados velhos. Também guarda onboardingUrl
  // pra reabrir o cadastro quando necessário.
  const syncWithStripe = useCallback(async (silent = false): Promise<void> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    if (!silent) setSyncing(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/creator-payout-update-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )
      const body = await res.json().catch(() => ({}))
      const nextUrl = (body?.onboarding_url ?? body?.url ?? null) as string | null
      if (nextUrl) setOnboardingUrl(nextUrl)
    } catch {
      /* ignore — Realtime e polling vão pegar */
    } finally {
      if (!silent) setSyncing(false)
    }
  }, [])

  // Bootstrap: sync inicial + se ainda não tem stripe_account_id, cria a conta.
  useEffect(() => {
    if (!userId || bootstrapped) return
    let cancelled = false
    ;(async () => {
      await syncWithStripe(true)
      if (cancelled) return
      const supabase = createClient()
      const { data } = await supabase
        .from('creator_payout_info')
        .select('account_details')
        .eq('creator_id', userId)
        .maybeSingle()
      const hasAccount = !!(data?.account_details as { stripe_account_id?: string } | null)?.stripe_account_id
      if (!hasAccount && !onboardingUrl) {
        const result = await createStripeAccount(supabase)
        if (cancelled) return
        if ('completed' in result) {
          // Realtime vai redirecionar — não fazer nada aqui.
        } else if ('verifying' in result) {
          // Idem.
        } else if ('error' in result) {
          toast.error(result.error)
        } else {
          setOnboardingUrl(result.url)
        }
      }
      setBootstrapped(true)
    })()
    return () => { cancelled = true }
  }, [userId, bootstrapped, syncWithStripe, onboardingUrl])

  // Redirect automático quando o Stripe aprova (charges_enabled && payouts_enabled).
  // Vem via Realtime — sem precisar clicar em nada.
  useEffect(() => {
    if (gate?.ready) {
      toast.success('Conta Stripe verificada pelo Stripe!')
      router.replace('/home')
    }
  }, [gate?.ready, router])

  const handleCheckAgain = async () => {
    await syncWithStripe(false)
  }

  // Reabre o cadastro do Stripe para corrigir/preencher requisitos pendentes.
  const handleReopenOnboarding = async () => {
    setReopening(true)
    try {
      if (onboardingUrl) {
        window.open(onboardingUrl, '_blank')
        return
      }
      const supabase = createClient()
      const result = await createStripeAccount(supabase)
      if ('completed' in result || 'verifying' in result) return
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      window.open(result.url, '_blank')
      setOnboardingUrl(result.url)
    } finally {
      setReopening(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Estado vindo do Stripe (via creator_payout_info.account_details).
  const details = gate?.accountDetails ?? null
  const chargesEnabled = details?.charges_enabled === true
  const payoutsEnabled = details?.payouts_enabled === true
  const detailsSubmitted = (details as { details_submitted?: boolean } | null)?.details_submitted === true
  const reason = gate?.reason ?? null
  const pending = Array.from(new Set([...(gate?.currentlyDue ?? []), ...(gate?.pastDue ?? [])]))
  const lastSyncedAt = (details as { last_synced_at?: string } | null)?.last_synced_at ?? null

  // "Aguardando Stripe" = Stripe está validando, creator não tem o que fazer.
  // Não confundir com REJECTED (creator precisa corrigir).
  const awaitingStripe = !!reason && STRIPE_WAIT_REASONS.has(reason)
  const needsAction = (!!reason && !awaitingStripe) || pending.length > 0 || !detailsSubmitted

  return (
    <div className="max-w-[520px] mx-auto p-6 text-center">
      <h1 className="text-[22px] font-semibold mb-2">Configurar pagamentos</h1>

      {loading || !gate ? (
        <p className="text-[var(--color-muted)] text-sm">{t('common.loading')}</p>
      ) : (
        <>
          {/* Painel de status do Stripe — fonte de verdade são os campos do Stripe */}
          <div className="rounded-xl bg-[var(--color-surface-2)] px-5 py-4 text-left mb-5">
            <p className="text-[var(--color-foreground)] font-semibold mb-2">
              Status no Stripe
            </p>
            <ul className="text-sm text-[var(--color-foreground)] space-y-1">
              <li className="flex items-center gap-2">
                <span className={['inline-block w-2 h-2 rounded-full', detailsSubmitted ? 'bg-green-500' : 'bg-[var(--color-muted)]'].join(' ')} />
                Formulário do Stripe enviado
              </li>
              <li className="flex items-center gap-2">
                <span className={['inline-block w-2 h-2 rounded-full', chargesEnabled ? 'bg-green-500' : 'bg-[var(--color-muted)]'].join(' ')} />
                Receber pagamentos (charges_enabled)
              </li>
              <li className="flex items-center gap-2">
                <span className={['inline-block w-2 h-2 rounded-full', payoutsEnabled ? 'bg-green-500' : 'bg-[var(--color-muted)]'].join(' ')} />
                Receber repasse no banco (payouts_enabled)
              </li>
            </ul>
            {lastSyncedAt && (
              <p className="text-xs text-[var(--color-muted)] mt-3">
                Sincronizado com o Stripe {formatRelativeTime(lastSyncedAt)}
              </p>
            )}
          </div>

          {/* Motivo do Stripe — só aparece se o Stripe enviou um.
              Cor depende de "aguardando Stripe" (azul/info) vs "precisa de ação" (vermelho). */}
          {reason && (
            <div
              className={
                awaitingStripe
                  ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-xl px-5 py-4 text-left mb-5'
                  : 'bg-[var(--color-error,#ef4444)]/10 border border-[var(--color-error,#ef4444)]/30 rounded-xl px-5 py-4 text-left mb-5'
              }
            >
              <p
                className={
                  awaitingStripe
                    ? 'text-[var(--color-primary)] font-semibold mb-1'
                    : 'text-[var(--color-error,#ef4444)] font-semibold mb-1'
                }
              >
                {humanizeReason(reason)}
              </p>
              <p className="text-[var(--color-muted)] text-xs leading-relaxed">
                Mensagem original do Stripe: <code className="text-[var(--color-foreground)]">{reason}</code>
              </p>
            </div>
          )}

          {/* Pendências do Stripe — só aparece se o Stripe enviou */}
          {pending.length > 0 && (
            <div className="text-left bg-[var(--color-surface-2)] rounded-xl px-5 py-4 mb-5">
              <p className="text-[var(--color-foreground)] font-semibold mb-2">
                O Stripe está pedindo:
              </p>
              <ul className="list-disc list-inside text-sm text-[var(--color-foreground)] space-y-1">
                {pending.map((field) => (
                  <li key={field}>
                    {humanizeRequirement(field)}{' '}
                    <span className="text-xs text-[var(--color-muted)]">({field})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instrução com base no que o Stripe diz */}
          {!detailsSubmitted && (
            <p className="text-[var(--color-muted)] text-sm mb-6">
              Você ainda não terminou o cadastro no Stripe. Abra o cadastro pra continuar.
            </p>
          )}
          {detailsSubmitted && awaitingStripe && pending.length === 0 && (
            <p className="text-[var(--color-muted)] text-sm mb-6 leading-relaxed">
              Não é preciso fazer nada — o Stripe está verificando. Esta página atualiza
              sozinha quando o resultado sair, você não precisa ficar recarregando. Na
              maioria dos casos a liberação sai em poucos minutos, mas a verificação de
              documento pode levar de <strong>1 a 3 dias úteis</strong> e, em casos mais
              raros, até uma semana. Enquanto isso você não consegue vender conteúdo,
              criar lives nem ficar online.
            </p>
          )}
          {detailsSubmitted && !reason && pending.length === 0 && !gate.ready && (
            <p className="text-[var(--color-muted)] text-sm mb-6 leading-relaxed">
              O Stripe está validando suas informações. A análise costuma sair em
              minutos, mas pode levar de <strong>1 a 3 dias úteis</strong> dependendo do
              documento enviado. Esta página se atualiza sozinha quando o Stripe responder.
            </p>
          )}
          {detailsSubmitted && needsAction && (
            <p className="text-[var(--color-muted)] text-sm mb-6 leading-relaxed">
              Reabra o cadastro do Stripe para corrigir/enviar o que falta. Enquanto isso
              você não consegue vender conteúdo, criar lives nem ficar online.
            </p>
          )}

          {/* Ação primária só aparece quando o creator precisa fazer alguma coisa.
              Em awaitingStripe (Stripe verificando) NÃO mostramos botão pra reabrir
              o cadastro — não há nada pra corrigir. */}
          {needsAction && (
            <button
              type="button"
              onClick={handleReopenOnboarding}
              disabled={reopening}
              className={[
                'px-8 py-3.5 rounded-[10px] border-none bg-[var(--color-primary)] text-white font-semibold text-[15px] w-full mb-3',
                reopening ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100',
              ].join(' ')}
            >
              {reopening
                ? 'Abrindo...'
                : detailsSubmitted
                  ? 'Reabrir cadastro no Stripe'
                  : 'Abrir cadastro no Stripe'}
            </button>
          )}

          <button
            type="button"
            onClick={handleCheckAgain}
            disabled={syncing}
            className={[
              'px-8 py-3.5 rounded-[10px] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] font-semibold text-[15px] w-full',
              syncing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100',
            ].join(' ')}
          >
            {syncing ? 'Consultando Stripe...' : 'Consultar Stripe agora'}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 px-6 py-3 rounded-[10px] border border-[var(--color-error,#ef4444)] bg-transparent text-[var(--color-error,#ef4444)] font-semibold cursor-pointer text-[15px] w-full"
      >
        Sair da conta
      </button>
    </div>
  )
}

export default function StripeSetupPage() {
  return (
    <Suspense>
      <StripeSetupContent />
    </Suspense>
  )
}
