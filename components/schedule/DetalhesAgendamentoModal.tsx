'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { TipoEventoAgenda } from './CardEventoAgenda'
import { useTranslation, getLocaleBcp47 } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface DetalhesAgendamentoModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  clientName: string
  duration: string
  value?: number
  date: string
  time: string
  typeEvent: TipoEventoAgenda
  /** ID do evento (live_streams.id ou one_on_one_calls.id) */
  eventId?: string | null
  /** Callback executado após cancelar com sucesso */
  onCancel?: () => void
  /** Status derivado do evento (para ocultar botão de cancelar em eventos finalizados) */
  status?: 'upcoming' | 'available' | 'finished' | 'cancelled'
  /** Status real da call vindo de one_on_one_calls (requested, confirmed, etc.) */
  callStatus?: string
  /** ISO datetime (UTC) do início agendado da call */
  scheduledStartTime?: string
  /** Duração em minutos da call */
  scheduledDurationMinutes?: number
}

// ─── Ícones ───────────────────────────────────────────────────────

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
)

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const TimerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2" />
    <path d="M5 3L2 6" />
    <path d="M22 6l-3-3" />
    <line x1="12" y1="1" x2="12" y2="3" />
  </svg>
)

const DollarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
)

// ─── Cores por tipo (labels resolvidos dentro do componente via t()) ────────

const typeColors: Record<TipoEventoAgenda, { color: string; bg: string }> = {
  live: { color: '#6E8BFF', bg: 'rgba(110, 139, 255, 0.15)' },
  call: { color: '#FFDF6E', bg: 'rgba(255, 223, 110, 0.15)' },
}

// ─── Keyframes CSS ─────────────────────────────────────────────────

const modalKeyframes = `
@keyframes detalhesOverlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes detalhesModalIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
`

export default function DetalhesAgendamentoModal({
  isOpen,
  onClose,
  title,
  clientName,
  duration,
  value = 100,
  date,
  time,
  typeEvent,
  eventId,
  onCancel,
  status,
  callStatus,
  scheduledStartTime,
  scheduledDurationMinutes,
}: DetalhesAgendamentoModalProps) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmOpen) setConfirmOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, confirmOpen])

  // Reset confirm state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmOpen(false)
      setCancelling(false)
    }
  }, [isOpen])

  // Calcula se o creator pode entrar na videochamada.
  // - Legado (`confirmed` + scheduled_start_time): janela de 5 min antes até o fim.
  // - Novo fluxo (`paid` sem scheduled_start_time): livre até 2h após pagamento.
  const { canJoinCall, callStartTimeFormatted } = useMemo(() => {
    if (typeEvent !== 'call') {
      return { canJoinCall: false, callStartTimeFormatted: '' }
    }

    // Fluxo novo — paid (sem horário agendado)
    if (callStatus === 'paid') {
      return { canJoinCall: true, callStartTimeFormatted: '' }
    }

    // Legado — confirmed + horário marcado
    if (callStatus === 'confirmed' && scheduledStartTime) {
      const startMs = new Date(scheduledStartTime).getTime()
      const durationMs = (scheduledDurationMinutes ?? 60) * 60 * 1000
      const endMs = startMs + durationMs
      const windowStartMs = startMs - 5 * 60 * 1000
      const now = Date.now()
      const canJoin = now >= windowStartMs && now <= endMs
      const formatted = new Date(scheduledStartTime).toLocaleTimeString(getLocaleBcp47(locale), {
        hour: '2-digit',
        minute: '2-digit',
      })
      return { canJoinCall: canJoin, callStartTimeFormatted: formatted }
    }

    return { canJoinCall: false, callStartTimeFormatted: '' }
  }, [typeEvent, callStatus, scheduledStartTime, scheduledDurationMinutes, locale])

  if (!isOpen) return null

  const terminalCallStatuses = ['completed', 'cancelled_by_user', 'cancelled_by_creator', 'rejected', 'expired']
  const canCancel = !!eventId
    && status !== 'finished'
    && status !== 'cancelled'
    && (!callStatus || !terminalCallStatuses.includes(callStatus))

  const handleCancel = async () => {
    if (!eventId) return
    setCancelling(true)
    try {
      const supabase = createClient()
      if (typeEvent === 'live') {
        const { error } = await supabase
          .from('live_streams')
          .update({ status: 'cancelled' })
          .eq('id', eventId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('one_on_one_calls')
          .update({ status: 'cancelled_by_creator' })
          .eq('id', eventId)
        if (error) throw error
      }
      toast.success(t('schedule.eventCancelled'))
      setConfirmOpen(false)
      onClose()
      onCancel?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('schedule.errorCancel'))
    } finally {
      setCancelling(false)
    }
  }

  // Call status badge
  const callStatusBadge = (() => {
    if (!callStatus) return null
    const map: Record<string, { color: string; bg: string; label: string }> = {
      requested: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: t('schedule.pending') },
      awaiting_payment: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: t('schedule.pending') },
      paid: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', label: t('schedule.confirmed') },
      confirmed: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', label: t('schedule.confirmed') },
      completed: { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', label: t('schedule.completed') },
      cancelled_by_user: { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', label: t('schedule.cancelled') },
      cancelled_by_creator: { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', label: t('schedule.cancelled') },
      rejected: { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', label: t('schedule.callStatusRejected') },
      expired: { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', label: t('schedule.cancelled') },
    }
    return map[callStatus] ?? null
  })()

  const valueFormatted = new Intl.NumberFormat(getLocaleBcp47(locale), { style: 'currency', currency: 'BRL' }).format(value)
  const typeLabels: Record<TipoEventoAgenda, string> = {
    live: t('schedule.live').toUpperCase(),
    call: t('schedule.videoCall').toUpperCase(),
  }
  const cfg = { ...typeColors[typeEvent] ?? typeColors.live, label: typeLabels[typeEvent] ?? typeLabels.live }

  return (
    <>
      <style>{modalKeyframes}</style>

      {/* Overlay */}
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 bg-black/[0.65] backdrop-blur-[3px] z-[9998] flex items-center justify-center p-6 [animation:detalhesOverlayIn_180ms_ease_forwards]"
      >
        {/* Modal */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detalhes-agendamento-title"
          onClick={(e) => e.stopPropagation()}
          className="bg-[var(--color-surface)] rounded-[20px] p-0 w-full max-w-[440px] max-h-[85vh] overflow-y-auto [animation:detalhesModalIn_220ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
        >
          {/* Header com gradiente */}
          <div className="bg-[linear-gradient(135deg,rgba(174,50,195,0.12)_0%,rgba(101,22,147,0.08)_100%)] rounded-t-[20px] px-6 pt-5 pb-4 relative">
            {/* Botão fechar */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="absolute top-4 right-4 bg-white/[0.06] border-none cursor-pointer text-[var(--color-muted)] p-1.5 rounded-lg flex items-center justify-center transition-colors hover:text-[var(--color-foreground)] hover:bg-white/10"
            >
              <CloseIcon />
            </button>

            {/* Badge tipo + status da call */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-block text-[11px] font-bold tracking-[0.5px] px-2.5 py-[3px] rounded-[4px]"
                style={{ background: cfg.bg, color: cfg.color }} /* dynamic value - cannot be Tailwind */
              >
                {cfg.label}
              </span>
              {callStatusBadge && (
                <span
                  className="inline-block text-[11px] font-bold tracking-[0.5px] px-2.5 py-[3px] rounded-[4px]"
                  style={{ background: callStatusBadge.bg, color: callStatusBadge.color }} /* dynamic value - cannot be Tailwind */
                >
                  {callStatusBadge.label}
                </span>
              )}
            </div>

            {/* Título do evento */}
            <h2
              id="detalhes-agendamento-title"
              className="text-[22px] font-bold text-[var(--color-foreground)] m-0 leading-[1.3] pr-8"
            >
              {title}
            </h2>

            {/* Cliente */}
            {clientName && clientName !== '-' && (
              <div className="flex items-center gap-1.5 mt-2">
                <UserIcon />
                <span className="text-[13px] text-[var(--color-muted)]">
                  {clientName}
                </span>
              </div>
            )}
          </div>

          {/* Corpo: campos em grid */}
          <div className="px-6 pt-5 pb-6">
            <div className="grid grid-cols-2 gap-3">
              <FieldCard icon={<CalendarIcon />} label={t('schedule.date')} value={date} />
              <FieldCard icon={<ClockIcon />} label={t('schedule.time')} value={time} />
              <FieldCard icon={<TimerIcon />} label={t('schedule.duration')} value={duration} />
              <FieldCard icon={<DollarIcon />} label={t('schedule.ticketPrice')} value={valueFormatted} />
            </div>

            {/* Botões */}
            <div className="flex flex-col gap-2 mt-5">
              {/* Botão entrar na videochamada (paid = novo fluxo, confirmed = legado) */}
              {typeEvent === 'call' && (callStatus === 'paid' || callStatus === 'confirmed') && canJoinCall && (
                <button
                  type="button"
                  onClick={() => router.push(`/video-call/${eventId}`)}
                  className="w-full h-11 rounded-[10px] border-none bg-[var(--color-primary)] text-white text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
                >
                  {t('schedule.joinVideoCall')}
                </button>
              )}

              {/* Texto informativo quando fora da janela de tempo (só legado) */}
              {typeEvent === 'call' && callStatus === 'confirmed' && !canJoinCall && callStartTimeFormatted && (
                <p className="text-[13px] text-[var(--color-muted)] text-center m-0">
                  {t('schedule.callAvailableAt').replace('{time}', callStartTimeFormatted)}
                </p>
              )}

              {/* Botão fechar */}
              {!confirmOpen && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full h-11 rounded-[10px] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] text-sm font-semibold cursor-pointer transition-colors hover:bg-[var(--color-surface-2)] hover:border-[var(--color-muted)]"
                >
                  {t('common.close')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Field Card ────────────────────────────────────────────────────

function FieldCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface-2)] rounded-[10px] px-3.5 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-muted)] flex shrink-0">{icon}</span>
        <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase tracking-[0.4px]">
          {label}
        </span>
      </div>
      <span className="text-[15px] font-medium text-[var(--color-foreground)]">
        {value}
      </span>
    </div>
  )
}
