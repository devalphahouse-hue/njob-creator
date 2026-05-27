'use client'

import { useRef, useEffect } from 'react'
import { Plus, Radio } from 'lucide-react'

interface ScheduleFabProps {
  showFabMenu: boolean
  dataSelect: Date
  onToggleMenu: () => void
  onCloseMenu: () => void
  onOpenNovoEvento: () => void
  tNewEvent: string
  tCreateLive: string
}

export function ScheduleFab({
  showFabMenu,
  onToggleMenu,
  onCloseMenu,
  onOpenNovoEvento,
  tNewEvent,
  tCreateLive,
}: ScheduleFabProps) {
  const fabMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showFabMenu) return
    const handler = (e: MouseEvent) => {
      if (fabMenuRef.current && !fabMenuRef.current.contains(e.target as Node)) {
        onCloseMenu()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFabMenu, onCloseMenu])

  return (
    <div ref={fabMenuRef} className="fixed bottom-[88px] right-5 z-40">
      {/* Menu popover */}
      {showFabMenu && (
        <div
          className="absolute bottom-16 right-0 bg-[var(--color-surface)] rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.28)] p-2 min-w-[240px] flex flex-col gap-1 [animation:detalhesModalIn_180ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
        >
          <button
            type="button"
            onClick={() => {
              onCloseMenu()
              onOpenNovoEvento()
            }}
            className="flex items-center gap-3 px-[14px] py-3 rounded-[10px] border-none bg-transparent text-[var(--color-foreground)] text-sm font-medium cursor-pointer w-full text-left transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <span className="flex text-[#6E8BFF]">
              <Radio size={18} />
            </span>
            {tCreateLive}
          </button>
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={onToggleMenu}
        aria-label={tNewEvent}
        className={[
          'w-14 h-14 rounded-full border-none bg-[var(--color-primary)] text-white cursor-pointer flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-transform duration-200',
          showFabMenu ? 'rotate-45' : 'rotate-0',
        ].join(' ')}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
    </div>
  )
}
