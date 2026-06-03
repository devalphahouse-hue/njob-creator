'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createStripeAccount } from '@/lib/supabase/creator'
import { useStripePayoutRealtime } from '@/lib/hooks/useStripePayoutRealtime'
import { useTranslation } from '@/lib/i18n'
import {
  CreditCard,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  FileText,
  RefreshCw,
  ArrowRight,
  Loader2,
  Lock,
} from 'lucide-react'

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

  // Badge de status (resumo no topo do card).
  const pill = !detailsSubmitted
    ? { label: 'Cadastro incompleto', cls: 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' }
    : needsAction && !awaitingStripe
      ? { label: 'Ação necessária', cls: 'bg-[var(--color-error,#ef4444)]/15 text-[var(--color-error,#ef4444)]' }
      : { label: 'Em análise', cls: 'bg-amber-500/15 text-amber-400' }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:h-screen">

        {/* Painel de marca — só no desktop */}
        <aside className="hidden lg:flex flex-col justify-between gap-10 px-10 py-12 bg-gradient-to-br from-[var(--color-primary)] to-[#7c3aed] text-white lg:overflow-y-auto">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-5">
              <CreditCard className="w-7 h-7 text-white" strokeWidth={1.75} />
            </div>
            <h1 className="text-[26px] font-bold leading-tight">Configurar pagamentos</h1>
            <p className="text-sm text-white/85 mt-3 leading-relaxed max-w-[320px]">
              Conecte sua conta no Stripe para receber pelas suas vendas com segurança.
            </p>
          </div>
          <ul className="space-y-3.5">
            {['Vender conteúdo e pacotes', 'Fazer lives com ingresso', 'Receber por chamadas de vídeo', 'Saques direto na sua conta'].map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-white/95">
                <CheckCircle2 className="w-[18px] h-[18px] shrink-0 text-white" />
                {b}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 text-xs text-white/75">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Pagamentos processados com segurança pelo Stripe.
          </div>
        </aside>

        {/* Conteúdo funcional */}
        <div className="min-h-screen lg:h-screen lg:overflow-y-auto flex flex-col justify-center lg:justify-start px-4 py-6 lg:px-12 lg:py-10 lg:bg-[var(--color-surface)]">
          <div className="w-full max-w-[520px] mx-auto lg:max-w-[480px] lg:my-auto">
          {/* Hero compacto — só no mobile */}
          <div className="lg:hidden flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[#7c3aed] flex items-center justify-center mb-4 shadow-lg shadow-[var(--color-primary)]/25">
              <CreditCard className="w-8 h-8 text-white" strokeWidth={1.75} />
            </div>
            <h1 className="text-[22px] font-bold">Configurar pagamentos</h1>
            <p className="text-sm text-[var(--color-muted)] mt-1.5 max-w-[360px] leading-relaxed">
              Conecte sua conta no Stripe para receber por vendas, conteúdo, lives e chamadas.
            </p>
          </div>

      {loading || !gate ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-muted)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">{t('common.loading')}</p>
        </div>
      ) : (
        <>
          {/* Painel de status do Stripe — fonte de verdade são os campos do Stripe */}
          <div className="rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] px-4 py-4 text-left mb-4">
            <div className="flex items-center justify-between mb-3.5">
              <p className="text-[var(--color-foreground)] font-semibold">Status no Stripe</p>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${pill.cls}`}>
                {pill.label}
              </span>
            </div>
            <ul className="text-sm space-y-3">
              {[
                { ok: detailsSubmitted, label: 'Cadastro enviado' },
                { ok: chargesEnabled, label: 'Pode receber pagamentos' },
                { ok: payoutsEnabled, label: 'Pode receber repasses no banco' },
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-2.5">
                  {row.ok ? (
                    <CheckCircle2 className="w-[18px] h-[18px] text-green-500 shrink-0" />
                  ) : (
                    <Circle className="w-[18px] h-[18px] text-[var(--color-muted)] shrink-0" />
                  )}
                  <span className={row.ok ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted)]'}>
                    {row.label}
                  </span>
                </li>
              ))}
            </ul>
            {lastSyncedAt && (
              <p className="text-xs text-[var(--color-muted)] mt-4 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Sincronizado {formatRelativeTime(lastSyncedAt)}
              </p>
            )}
          </div>

          {/* Motivo do Stripe — só aparece se o Stripe enviou um.
              Cor depende de "aguardando Stripe" (azul/info) vs "precisa de ação" (vermelho). */}
          {reason && (
            <div
              className={[
                'flex items-start gap-3 rounded-2xl border px-4 py-4 text-left mb-4',
                awaitingStripe
                  ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30'
                  : 'bg-[var(--color-error,#ef4444)]/10 border-[var(--color-error,#ef4444)]/30',
              ].join(' ')}
            >
              {awaitingStripe ? (
                <Clock className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-primary)]" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-error,#ef4444)]" />
              )}
              <div className="min-w-0">
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
                  Mensagem original do Stripe:{' '}
                  <code className="text-[var(--color-foreground)] break-all">{reason}</code>
                </p>
              </div>
            </div>
          )}

          {/* Pendências do Stripe — só aparece se o Stripe enviou */}
          {pending.length > 0 && (
            <div className="text-left bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl px-4 py-4 mb-4">
              <p className="text-[var(--color-foreground)] font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-[18px] h-[18px] text-[var(--color-primary)]" />
                O Stripe está pedindo
              </p>
              <ul className="text-sm space-y-2.5">
                {pending.map((field) => (
                  <li key={field} className="flex items-start gap-2.5">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                    <span className="text-[var(--color-foreground)]">
                      {humanizeRequirement(field)}{' '}
                      <span className="text-xs text-[var(--color-muted)] break-all">({field})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instrução com base no que o Stripe diz */}
          <div className="text-center text-sm text-[var(--color-muted)] leading-relaxed mb-5 px-1">
            {!detailsSubmitted && (
              <p>Você ainda não terminou o cadastro no Stripe. Abra o cadastro pra continuar.</p>
            )}
            {detailsSubmitted && awaitingStripe && pending.length === 0 && (
              <p>
                Não é preciso fazer nada — o Stripe está verificando e esta página atualiza
                sozinha quando o resultado sair. Em geral leva poucos minutos, mas a
                verificação de documento pode levar de <strong>1 a 3 dias úteis</strong>.
              </p>
            )}
            {detailsSubmitted && !reason && pending.length === 0 && !gate.ready && (
              <p>
                O Stripe está validando suas informações. Costuma sair em minutos, mas pode
                levar de <strong>1 a 3 dias úteis</strong>. Esta página se atualiza sozinha.
              </p>
            )}
            {detailsSubmitted && needsAction && (
              <p>Reabra o cadastro do Stripe para corrigir ou enviar o que falta.</p>
            )}
          </div>

          {/* Ações do Stripe. O botão de reabrir só aparece quando há ação a fazer
              (em awaitingStripe não há nada a corrigir). */}
          <div className="flex flex-col gap-3">
            {needsAction && (
              <button
                type="button"
                onClick={handleReopenOnboarding}
                disabled={reopening}
                className={[
                  'group w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-none text-white font-semibold text-[15px] bg-gradient-to-r from-[var(--color-primary)] to-[#7c3aed] shadow-lg shadow-[var(--color-primary)]/25 transition-all',
                  reopening ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-95',
                ].join(' ')}
              >
                {reopening ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Abrindo...
                  </>
                ) : (
                  <>
                    {detailsSubmitted ? 'Reabrir cadastro no Stripe' : 'Abrir cadastro no Stripe'}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleCheckAgain}
              disabled={syncing}
              className={[
                'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] font-medium text-sm transition-colors',
                syncing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              <RefreshCw className={['w-4 h-4', syncing ? 'animate-spin' : ''].join(' ')} />
              {syncing ? 'Consultando Stripe...' : 'Consultar Stripe agora'}
            </button>
          </div>
        </>
      )}

      {/* Continuar no app + sair — sempre visíveis */}
      <div className="mt-6 pt-6 border-t border-[var(--color-border)] flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/home')}
          className="group w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold text-[15px] transition-colors hover:bg-[var(--color-primary)]/15 cursor-pointer"
        >
          Continuar para o app
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <p className="text-xs text-[var(--color-muted)] text-center leading-relaxed max-w-[380px]">
          Você já pode usar o app. Venda, conteúdo, lives e chamadas são liberadas assim que o Stripe aprovar.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-error,#ef4444)] bg-transparent border-none cursor-pointer transition-colors"
        >
          Sair da conta
        </button>
      </div>
        </div>
      </div>
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
