'use client'

import CalendarioEventos from '@/components/schedule/CalendarioEventos'
import type { Database } from '@/lib/types/database'

type VwCreatorEventRow = Database['public']['Views']['vw_creator_events']['Row']
type TabCalendario = 'day' | 'week' | 'month'

interface DateSelectorProps {
  tabCalendarioSelect: TabCalendario
  dataSelect: Date
  eventos: VwCreatorEventRow[]
  onTabChange: (tab: TabCalendario) => void
  onDateChange: (date: Date) => void
  eventDateKeyFn: (row: VwCreatorEventRow) => string
  formatDDMMY: (d: Date) => string
  tDay: string
  tWeek: string
  tMonth: string
}

export function DateSelector({
  tabCalendarioSelect,
  dataSelect,
  eventos,
  onTabChange,
  onDateChange,
  eventDateKeyFn,
  formatDDMMY,
  tDay,
  tWeek,
  tMonth,
}: DateSelectorProps) {
  const tabs: { key: TabCalendario; label: string }[] = [
    { key: 'day', label: tDay },
    { key: 'week', label: tWeek },
    { key: 'month', label: tMonth },
  ]

  return (
    <>
      {/* Tabs Dia / Semana / Mês */}
      <div className="flex gap-2 mb-4">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              onTabChange(key)
              if (key === 'day') onDateChange(new Date())
            }}
            className={[
              'flex-1 py-[10px] px-4 rounded font-semibold text-sm cursor-pointer border-none transition-colors',
              tabCalendarioSelect === key
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-foreground)]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Calendar (hidden when day) */}
      {tabCalendarioSelect !== 'day' && (
        <div className="mb-4">
          <CalendarioEventos
            typeCalendario={tabCalendarioSelect === 'month' ? 'Mês' : 'Semana'}
            selectedDate={dataSelect}
            onDateSelected={onDateChange}
            height={tabCalendarioSelect === 'month' ? 400 : 150}
            datesWithEvents={[...new Set(eventos.map(eventDateKeyFn).filter(Boolean))]}
          />
        </div>
      )}

      {/* Selected date */}
      <div className="flex items-center mb-4">
        <span className="font-semibold text-[var(--color-foreground)] text-sm">
          {formatDDMMY(dataSelect)}
        </span>
      </div>
    </>
  )
}
