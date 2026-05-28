'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCreator } from '@/lib/store/app-store'
import { toast } from 'sonner'
import EmptyState from '@/components/ui/EmptyState'
import { useTranslation } from '@/lib/i18n'

const base = () => process.env.NEXT_PUBLIC_SUPABASE_URL!

// Shape do JSON devolvido por get-creator-financial-statement.
interface StatementShape {
  year: number
  month: number
  revenue_breakdown: {
    content_revenue: number
    live_revenue: number
    call_revenue: number
    subscription_revenue: number
  }
  total_revenue: number
  available_for_payout: number
  future_payouts: number
  completed_payouts: number
  transactions: { packs: number; lives: number; calls: number }
}

function formatBRL(v: number | null | undefined): string {
  return `R$ ${(Number(v ?? 0)).toFixed(2).replace('.', ',')}`
}

function StatementCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
      <div className="text-xs text-[var(--color-muted)] mb-1">{label}</div>
      <div className="text-lg font-bold text-[var(--color-foreground)]">{value}</div>
      {helper && <div className="text-[11px] text-[var(--color-muted)] mt-1">{helper}</div>}
    </div>
  )
}

function StatementSummary({ statement }: { statement: StatementShape }) {
  const rb = statement.revenue_breakdown
  const tx = statement.transactions
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <StatementCard label="Receita total no período" value={formatBRL(statement.total_revenue)} />
        <StatementCard label="Disponível para saque" value={formatBRL(statement.available_for_payout)} />
        <StatementCard label="Repasses programados" value={formatBRL(statement.future_payouts)} />
        <StatementCard label="Repasses concluídos" value={formatBRL(statement.completed_payouts)} />
      </div>
      <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
        <div className="text-xs text-[var(--color-muted)] font-semibold mb-2">Receita por origem</div>
        <div className="flex flex-col gap-1.5 text-sm text-[var(--color-foreground)]">
          <div className="flex justify-between"><span>Conteúdo (packs)</span><span>{formatBRL(rb.content_revenue)}</span></div>
          <div className="flex justify-between"><span>Lives</span><span>{formatBRL(rb.live_revenue)}</span></div>
          <div className="flex justify-between"><span>Videochamadas</span><span>{formatBRL(rb.call_revenue)}</span></div>
          <div className="flex justify-between"><span>Assinaturas</span><span>{formatBRL(rb.subscription_revenue)}</span></div>
        </div>
      </div>
      <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
        <div className="text-xs text-[var(--color-muted)] font-semibold mb-2">Transações no período</div>
        <div className="flex flex-col gap-1.5 text-sm text-[var(--color-foreground)]">
          <div className="flex justify-between"><span>Packs vendidos</span><span>{tx.packs}</span></div>
          <div className="flex justify-between"><span>Ingressos de live</span><span>{tx.lives}</span></div>
          <div className="flex justify-between"><span>Videochamadas</span><span>{tx.calls}</span></div>
        </div>
      </div>
    </div>
  )
}

async function getStatement(year: number, month: number, token: string): Promise<StatementShape> {
  const res = await fetch(`${base()}/functions/v1/get-creator-financial-statement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ year, month }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<StatementShape>
}

async function getPayoutLink(token: string): Promise<{ url?: string; error?: string }> {
  const res = await fetch(`${base()}/functions/v1/creator-payout-update-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  // Status 400 with account_onboarding error still returns a usable URL
  if (!res.ok && data?.error !== 'account_onboarding') {
    return { error: data?.message ?? data?.error ?? `HTTP ${res.status}` }
  }
  const url = data?.url ?? data?.login_url ?? data?.onboarding_url
  return url ? { url } : { error: 'Nenhum link retornado' }
}

export default function FinancialPage() {
  const router = useRouter()
  const supabase = createClient()
  const creator = useCreator()
  const { t } = useTranslation()
  const [tab, setTab] = useState(0)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return d.toISOString().slice(0, 10)
  })

  const { data: metrics } = useQuery({
    queryKey: ['get_creator_metrics', creator?.profile?.username],
    enabled: !!creator,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!uid || !token) return null
      const res = await fetch(`${base()}/rest/v1/rpc/get_creator_metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ p_profile_id: uid }),
      })
      if (!res.ok) return null
      const raw = await res.json()
      return Array.isArray(raw) ? raw[0] : raw
    },
  })

  const { data: statement, isLoading: statementLoading } = useQuery({
    queryKey: ['get-creator-financial-statement', year, month, creator?.profile?.username],
    enabled: !!creator && tab === 1,
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Não autenticado')
      return getStatement(year, month, token)
    },
  })

  const [payoutLoading, setPayoutLoading] = useState(false)

  const openPayoutLink = async () => {
    setPayoutLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) {
        toast.error(t('profile.sessionExpired'))
        return
      }
      const { url, error } = await getPayoutLink(token)
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
      setPayoutLoading(false)
    }
  }

  const tabs = [t('financial.totalEarnings'), t('financial.history'), t('financial.withdraw')]
  return (
    <div className="max-w-[720px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t('financial.title')}</h1>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-transparent border-none cursor-pointer p-1"
        >
          ← {t('common.back')}
        </button>
      </div>
      <div className="flex gap-2 mb-6">
        {tabs.map((tabLabel, i) => (
          <button
            key={tabLabel}
            type="button"
            onClick={() => setTab(i)}
            className={[
              'px-4 py-2 rounded-lg border-none font-semibold cursor-pointer text-sm',
              tab === i ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-foreground)]',
            ].join(' ')}
          >
            {tabLabel}
          </button>
        ))}
      </div>
      {tab === 0 && (
        <div className="flex flex-col gap-3">
          <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
            <div className="text-xs text-[var(--color-muted)] mb-1">{t('home.visits')} ({t('home.last30days')})</div>
            <div className="text-xl font-bold">{metrics?.visitas_30d ?? 0}</div>
          </div>
          <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
            <div className="text-xs text-[var(--color-muted)] mb-1">{t('home.likes')} ({t('home.last30days')})</div>
            <div className="text-xl font-bold">{metrics?.curtidas_30d ?? 0}</div>
          </div>
          <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
            <div className="text-xs text-[var(--color-muted)] mb-1">{t('home.revenue')} ({t('home.last30days')})</div>
            <div className="text-xl font-bold">R$ {Number(metrics?.faturamento_30d ?? 0).toFixed(2)}</div>
          </div>
        </div>
      )}
      {tab === 1 && (
        <>
          <div className="flex flex-col gap-3 mb-4">
            <div className="text-xs text-[var(--color-muted)] font-semibold">{t('financial.period')}</div>
            <div className="flex gap-2 items-center flex-wrap">
              <label className="flex items-center gap-1.5">
                <span className="text-sm text-[var(--color-muted)]">{t('schedule.date')}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setStartDate(v)
                    if (v) {
                      const [y, m] = v.split('-').map(Number)
                      setYear(y)
                      setMonth(m)
                    }
                  }}
                  className="p-2 rounded-lg border border-[var(--color-border)]"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-sm text-[var(--color-muted)]">{t('schedule.time')}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="p-2 rounded-lg border border-[var(--color-border)]"
                />
              </label>
            </div>
            <div className="flex gap-2 items-end">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-muted)]">Mês</span>
                <input
                  type="number"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value) || 1)}
                  min={1}
                  max={12}
                  className="w-[70px] p-2 rounded-lg border border-[var(--color-border)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-muted)]">Ano</span>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
                  className="w-24 p-2 rounded-lg border border-[var(--color-border)]"
                />
              </label>
            </div>
          </div>
          {statementLoading ? (
            <div className="p-6 text-center text-[var(--color-muted)]">{t('common.loading')}</div>
          ) : statement ? (
            <StatementSummary statement={statement} />
          ) : (
            <EmptyState title={t('financial.noTransactions')} description={t('financial.period')} />
          )}
        </>
      )}
      {tab === 2 && (
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
            <p className="text-sm text-[var(--color-foreground)] mb-2 font-semibold">
              Como funcionam os repasses
            </p>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Os saques são processados diretamente pelo Stripe, parceiro de pagamentos
              da plataforma. Clique abaixo para abrir o painel do Stripe e gerenciar
              sua conta bancária, ver os repasses programados e o histórico de saques.
            </p>
          </div>
          <button
            type="button"
            onClick={openPayoutLink}
            disabled={payoutLoading}
            className={[
              'px-6 py-3 rounded-lg border-none bg-[var(--color-primary)] text-white font-semibold text-sm',
              payoutLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100',
            ].join(' ')}
          >
            {payoutLoading ? t('common.loading') : 'Abrir painel Stripe'}
          </button>
        </div>
      )}
    </div>
  )
}
