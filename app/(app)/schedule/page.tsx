'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCreator } from '@/lib/store/app-store'
import type { Database } from '@/lib/types/database'
import DetalhesAgendamentoModal from '@/components/schedule/DetalhesAgendamentoModal'
import NovoEventoModal from '@/components/home/NovoEventoModal'
import { formatTimeLocal, eventDateKeyLocal } from '@/lib/utils/datetime'
import { useTranslation, getLocaleBcp47 } from '@/lib/i18n'
import { useLiveStreamCleanup } from '@/lib/hooks/useLiveStreamCleanup'
import { DateSelector } from './_components/DateSelector'
// AvailabilityBadge removido junto com a agenda fixa.
import { EventList } from './_components/EventList'
import { ScheduleFab } from './_components/ScheduleFab'

type VwCreatorEventRow = Database['public']['Views']['vw_creator_events']['Row']
type TabCalendario = 'day' | 'week' | 'month'

// ── Pure helpers ─────────────────────────────────────────────────────────────

function formatDDMMY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

function formatDMY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

function eventDateKey(row: VwCreatorEventRow): string {
  return eventDateKeyLocal(row.start_date, row.time)
}

function eventTimeISO(row: VwCreatorEventRow): string {
  if (!row.start_date || !row.time) return ''
  const timePart = String(row.time).slice(0, 5)
  return `${row.start_date}T${timePart}:00.000Z`
}

function deriveEventStatus(row: VwCreatorEventRow): 'upcoming' | 'available' | 'finished' {
  const iso = eventTimeISO(row)
  if (!iso) return 'upcoming'
  const eventTime = new Date(iso).getTime()
  const durationMin = row.duration_min ?? 60
  const eventEnd = eventTime + durationMin * 60 * 1000
  const bufferStart = eventTime - 15 * 60 * 1000
  const now = Date.now()
  if (now > eventEnd) return 'finished'
  if (now >= bufferStart) return 'available'
  return 'upcoming'
}

// isSlotPast removido junto com a lógica de slots.

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const supabase = createClient()
  const creator = useCreator()
  const { t, locale } = useTranslation()

  const [tabCalendarioSelect, setTabCalendarioSelect] = useState<TabCalendario>('month')
  const [dataSelect, setDataSelect] = useState<Date>(() => new Date())
  const [modalNovoOpen, setModalNovoOpen] = useState(false)
  const [detalhesEvento, setDetalhesEvento] = useState<VwCreatorEventRow | null>(null)
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'live' | 'call'>('all')

  // ── Query: events ────────────────────────────────────────────────────────────
  const {
    data: eventos = [],
    isLoading: eventosLoading,
    refetch: refetchEventos,
  } = useQuery<VwCreatorEventRow[]>({
    queryKey: ['vw_creator_events', 'schedule', creator?.profile.username],
    enabled: !!creator,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id
      if (!userId) return []
      const { data, error } = await supabase
        .from('vw_creator_events')
        .select('*')
        .eq('creator_id', userId)
      if (error) {
        console.error('[SchedulePage] vw_creator_events error:', error)
        return []
      }
      return data ?? []
    },
  })

  // ── Query: call details ──────────────────────────────────────────────────────
  const callEventIds = useMemo(
    () => eventos.filter((e) => e.event_type === 'call' && e.event_id).map((e) => e.event_id!),
    [eventos],
  )

  const { data: callInfoMap = new Map<string, { status: string; clientName: string }>() } = useQuery({
    queryKey: ['call_details', callEventIds],
    enabled: callEventIds.length > 0,
    queryFn: async () => {
      const { data: calls, error: callsErr } = await supabase
        .from('one_on_one_calls')
        .select('id, status, user_id')
        .in('id', callEventIds)
      if (callsErr || !calls?.length) return new Map<string, { status: string; clientName: string }>()

      const userIds = [...new Set(calls.map((c) => c.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      const profileMap = new Map<string, string>()
      profiles?.forEach((p) => profileMap.set(p.id, p.full_name || ''))

      const result = new Map<string, { status: string; clientName: string }>()
      calls.forEach((c) => {
        result.set(c.id, {
          status: c.status,
          clientName: profileMap.get(c.user_id) || '',
        })
      })
      return result
    },
  })

  // ── L3: Lazy status cleanup ──────────────────────────────────────────────────
  useLiveStreamCleanup(creator, refetchEventos)

  // ── Derived state ────────────────────────────────────────────────────────────
  const selectedKey = formatDMY(dataSelect)
  const listaEventos = eventos.filter((e) => {
    if (eventDateKey(e) !== selectedKey) return false
    if (filterType === 'live') return e.event_type === 'live'
    if (filterType === 'call') return e.event_type === 'call'
    return true
  })

  const handleRefresh = useCallback(() => {
    refetchEventos()
  }, [refetchEventos])

  const openDetalhes = useCallback((evento: VwCreatorEventRow) => {
    setDetalhesEvento(evento)
  }, [])

  // ── Detalhe do evento selecionado ────────────────────────────────────────────
  const detCallInfo =
    detalhesEvento?.event_type === 'call' && detalhesEvento.event_id
      ? callInfoMap.get(detalhesEvento.event_id)
      : undefined

  return (
    <>
      <div className="max-w-[720px] mx-auto pb-20">
        {/* Header */}
        <h1 className="text-xl font-semibold text-[var(--color-foreground)] mt-0 mb-4">
          {t('schedule.title')}
        </h1>

        <DateSelector
          tabCalendarioSelect={tabCalendarioSelect}
          dataSelect={dataSelect}
          eventos={eventos}
          onTabChange={setTabCalendarioSelect}
          onDateChange={setDataSelect}
          eventDateKeyFn={eventDateKey}
          formatDDMMY={formatDDMMY}
          tDay={t('schedule.day')}
          tWeek={t('schedule.week')}
          tMonth={t('schedule.month')}
          tDetails={t('schedule.details')}
        />

        <EventList
          isLoading={eventosLoading}
          eventos={listaEventos}
          filterType={filterType}
          callInfoMap={callInfoMap}
          onFilterChange={setFilterType}
          onEventTap={openDetalhes}
          formatTimeLocal={formatTimeLocal}
          eventTimeISOFn={eventTimeISO}
          localeBcp47={getLocaleBcp47(locale)}
          tFilterAll={t('schedule.filterAll')}
          tFilterLives={t('schedule.filterLives')}
          tFilterCalls={t('schedule.filterCalls')}
          tNoCallsYet={t('schedule.noCallsYet')}
          tNoEvents={t('schedule.noEvents')}
        />
      </div>

      <ScheduleFab
        showFabMenu={showFabMenu}
        dataSelect={dataSelect}
        onToggleMenu={() => setShowFabMenu((v) => !v)}
        onCloseMenu={() => setShowFabMenu(false)}
        onOpenNovoEvento={() => setModalNovoOpen(true)}
        tNewEvent={t('events.newEvent')}
        tCreateLive={t('events.createLive')}
      />

      <NovoEventoModal
        isOpen={modalNovoOpen}
        onClose={() => setModalNovoOpen(false)}
        onRefresh={handleRefresh}
        initialDate={dataSelect}
      />

      {detalhesEvento && (
        <DetalhesAgendamentoModal
          isOpen={!!detalhesEvento}
          onClose={() => setDetalhesEvento(null)}
          title={detalhesEvento.title ?? detalhesEvento.event_name ?? '-'}
          clientName={detCallInfo?.clientName || detalhesEvento.event_name || '-'}
          duration={`${detalhesEvento.duration_min ?? '-'} min`}
          value={detalhesEvento.ticket_price ?? undefined}
          date={formatDDMMY(new Date(detalhesEvento.start_date ?? ''))}
          time={formatTimeLocal(eventTimeISO(detalhesEvento) || undefined, getLocaleBcp47(locale))}
          typeEvent={(detalhesEvento.event_type ?? 'call') as 'live' | 'call'}
          eventId={detalhesEvento.event_id}
          status={deriveEventStatus(detalhesEvento)}
          callStatus={detCallInfo?.status}
          scheduledStartTime={eventTimeISO(detalhesEvento) || undefined}
          scheduledDurationMinutes={detalhesEvento.duration_min ?? undefined}
          onCancel={() => {
            setDetalhesEvento(null)
            refetchEventos()
          }}
        />
      )}
    </>
  )
}
