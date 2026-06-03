'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCreator } from '@/lib/store/app-store'
import { useTranslation } from '@/lib/i18n'
import { getPacksByCreator, type PackListItem } from '@/lib/api/content'
import EmptyState from '@/components/ui/EmptyState'
import { Filter, Plus } from 'lucide-react'
import { useStripeGateState } from '@/components/stripe/StripeGateProvider'
import { useStripeGate } from '@/lib/hooks/useStripeGate'

interface AppliedFilters {
  hasPhoto: boolean | null
  hasVideo: boolean | null
  startDate: string
  endDate: string
}

const emptyFilters: AppliedFilters = { hasPhoto: null, hasVideo: null, startDate: '', endDate: '' }

function countActive(f: AppliedFilters): number {
  let n = 0
  if (f.hasPhoto === true) n++
  if (f.hasVideo === true) n++
  if (f.startDate) n++
  if (f.endDate) n++
  return n
}

export default function ContentPage() {
  const supabase = createClient()
  const creator = useCreator()
  const router = useRouter()
  const { t } = useTranslation()
  const { ready: stripeReady } = useStripeGateState()
  const { ensureReady: ensureStripeReady } = useStripeGate()

  // Filtros aplicados (usados para filtrar a lista)
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters)

  // Filtros temporários (estado do modal enquanto o usuário seleciona)
  const [draft, setDraft] = useState<AppliedFilters>(emptyFilters)
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  const { data: packs = [], isLoading } = useQuery({
    queryKey: [
      'get_packs_by_creator',
      creator?.profile?.username,
      applied.hasPhoto,
      applied.hasVideo,
      applied.startDate,
      applied.endDate,
    ],
    enabled: !!creator,
    retry: 1,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return []
      return getPacksByCreator(user.id, token, {
        has_photo: applied.hasPhoto ?? undefined,
        has_video: applied.hasVideo ?? undefined,
        start_date: applied.startDate || undefined,
        end_date: applied.endDate || undefined,
      })
    },
  })

  const activeCount = countActive(applied)
  const hasActiveFilters = activeCount > 0

  // Abrir modal: copiar filtros aplicados para o draft
  const openFilterModal = () => {
    setDraft({ ...applied })
    setFilterModalOpen(true)
  }

  // Aplicar: copiar draft para applied e fechar
  const applyAndClose = () => {
    setApplied({ ...draft })
    setFilterModalOpen(false)
  }

  // Limpar: resetar draft e applied, fechar modal
  const clearFilters = () => {
    setDraft(emptyFilters)
    setApplied(emptyFilters)
    setFilterModalOpen(false)
  }

  // Limpar tudo (dentro do modal, sem fechar)
  const clearDraft = () => {
    setDraft(emptyFilters)
  }

  return (
    <div className="max-w-[720px] mx-auto pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold m-0">{t('content.salesTitle')}</h1>
        <button
          type="button"
          onClick={openFilterModal}
          className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-medium text-[var(--color-foreground)] cursor-pointer inline-flex items-center gap-2"
        >
          <Filter size={18} strokeWidth={2} />
          <span>{t('content.filters')}</span>
          {hasActiveFilters && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold inline-flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>
      {filterModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('content.contentFilters')}
          className="content-filters-overlay fixed inset-0 z-50 bg-black/60 flex p-6"
          onClick={() => setFilterModalOpen(false)}
        >
          <div
            className="content-filters-panel bg-[var(--color-surface)] rounded-[var(--radius-lg)] p-6 max-w-[380px] w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="m-0 text-lg font-semibold">{t('content.filters')}</h3>
              {countActive(draft) > 0 && (
                <button
                  type="button"
                  onClick={clearDraft}
                  className="px-3 py-1.5 border-none bg-transparent text-[var(--color-muted)] text-[13px] cursor-pointer"
                >
                  {t('content.clearAll')}
                </button>
              )}
            </div>

            <section className="mb-5">
              <p className="m-0 mb-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-[0.04em]">
                {t('content.mediaType')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, hasPhoto: d.hasPhoto === true ? null : true }))}
                  className={[
                    'min-h-[44px] px-4 rounded-full border border-[var(--color-border)] text-sm cursor-pointer',
                    draft.hasPhoto === true ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-foreground)]',
                  ].join(' ')}
                >
                  {t('content.withPhoto')}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, hasVideo: d.hasVideo === true ? null : true }))}
                  className={[
                    'min-h-[44px] px-4 rounded-full border border-[var(--color-border)] text-sm cursor-pointer',
                    draft.hasVideo === true ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-foreground)]',
                  ].join(' ')}
                >
                  {t('content.withVideo')}
                </button>
              </div>
            </section>

            <section className="mb-6">
              <p className="m-0 mb-2.5 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-[0.04em]">
                {t('financial.period')}
              </p>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-[var(--color-foreground)]">{t('content.from')}</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                    className="min-h-[44px] px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-foreground)] text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-[var(--color-foreground)]">{t('content.until')}</span>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                    className="min-h-[44px] px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-foreground)] text-sm"
                  />
                </label>
              </div>
            </section>

            <div className="flex gap-3 pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-[48px] flex-1 px-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] text-[15px] font-medium cursor-pointer"
              >
                {t('content.clear')}
              </button>
              <button
                type="button"
                onClick={applyAndClose}
                className="min-h-[48px] flex-1 px-4 rounded-[var(--radius-md)] border-none bg-[var(--color-primary)] text-white text-[15px] font-semibold cursor-pointer"
              >
                {t('content.apply')}
              </button>
            </div>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="p-8 text-center text-[var(--color-muted)]">{t('common.loading')}</div>
      ) : packs.length === 0 ? (
        <EmptyState title={t('content.noPackages')} description={hasActiveFilters ? t('content.noFilterResults') : t('content.createFirstPackage')} icon="📦" />
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
          {(packs as PackListItem[]).map((p) => (
            <button
              key={p.pack_id}
              type="button"
              onClick={() => router.push(`/content/${p.pack_id}/edit`)}
              className="text-left p-0 border-none rounded-lg overflow-hidden bg-[var(--color-surface-2)] cursor-pointer shadow-sm"
            >
              <div className="relative bg-[var(--color-border)] aspect-square">
                {p.cover_image_url ? (
                  <img src={p.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--color-muted)] text-xs">
                    {t('content.noCover')}
                  </div>
                )}
              </div>
              <div className="p-2">
                <div className="font-semibold text-sm mb-1">{p.title}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  R$ {Number(p.price).toFixed(2)} · {p.photo_count ?? 0} {t('content.photos')} · {p.video_count ?? 0} {t('content.videos')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="fixed bottom-[88px] right-5 z-40">
        <button
          type="button"
          onClick={async () => {
            if (!(await ensureStripeReady())) return
            router.push('/content/create')
          }}
          aria-label={t('content.createPackage')}
          title={stripeReady ? t('content.createPackage') : t('content.stripeLockedHint')}
          className={[
            'w-14 h-14 rounded-full border-none bg-[var(--color-primary)] text-white flex items-center justify-center',
            stripeReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
          ].join(' ')}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
