'use client'

import Spinner from '@/components/ui/Spinner'
import CardEventoAgenda from '@/components/schedule/CardEventoAgenda'
import type { Database } from '@/lib/types/database'

type VwCreatorEventRow = Database['public']['Views']['vw_creator_events']['Row']

interface EventListProps {
  isLoading: boolean
  eventos: VwCreatorEventRow[]
  filterType: 'all' | 'live' | 'call'
  callInfoMap: Map<string, { status: string; clientName: string }>
  onFilterChange: (filter: 'all' | 'live' | 'call') => void
  onEventTap: (evento: VwCreatorEventRow) => void
  formatTimeLocal: (iso: string | undefined, locale: string) => string
  eventTimeISOFn: (row: VwCreatorEventRow) => string
  localeBcp47: string
  tFilterAll: string
  tFilterLives: string
  tFilterCalls: string
  tNoCallsYet: string
  tNoEvents: string
}

export function EventList({
  isLoading,
  eventos,
  filterType,
  callInfoMap,
  onFilterChange,
  onEventTap,
  formatTimeLocal,
  eventTimeISOFn,
  localeBcp47,
  tFilterAll,
  tFilterLives,
  tFilterCalls,
  tNoCallsYet,
  tNoEvents,
}: EventListProps) {
  const filterOptions: {
    key: 'all' | 'live' | 'call'
    label: string
    activeBg: string
    activeColor: string
  }[] = [
    { key: 'all', label: tFilterAll, activeBg: 'var(--color-primary)', activeColor: '#fff' },
    { key: 'live', label: tFilterLives, activeBg: '#6E8BFF', activeColor: '#fff' },
    { key: 'call', label: tFilterCalls, activeBg: '#FFDF6E', activeColor: '#1a1a1a' },
  ]

  return (
    <>
      {/* Filtro por tipo */}
      <div className="flex gap-2 mb-4">
        {filterOptions.map(({ key, label, activeBg, activeColor }) => {
          const active = filterType === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className="px-[14px] py-[6px] rounded-[20px] border-none font-semibold text-xs cursor-pointer transition-all"
              style={{
                background: active ? activeBg : 'var(--color-surface-2)', /* dynamic value - cannot be Tailwind */
                color: active ? activeColor : 'var(--color-muted)', /* dynamic value - cannot be Tailwind */
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Lista de eventos */}
      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {eventos.length === 0 ? (
            <div className="py-6">
              <p className="text-[var(--color-muted)] text-sm m-0">
                {filterType === 'call' ? tNoCallsYet : tNoEvents}
              </p>
            </div>
          ) : (
            eventos.map((ev) => {
              const callInfo =
                ev.event_type === 'call' && ev.event_id
                  ? callInfoMap.get(ev.event_id)
                  : undefined
              return (
                <CardEventoAgenda
                  key={ev.event_id ?? ev.title ?? ''}
                  title={ev.title ?? ev.event_name ?? '-'}
                  time={formatTimeLocal(eventTimeISOFn(ev) || undefined, localeBcp47)}
                  typeEvent={(ev.event_type ?? 'call') as 'live' | 'call'}
                  duration={String(ev.duration_min ?? '-')}
                  count={ev.attendee_count ?? undefined}
                  callStatus={callInfo?.status}
                  clientName={callInfo?.clientName}
                  onTap={() => onEventTap(ev)}
                />
              )
            })
          )}
        </div>
      )}
    </>
  )
}
