'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Video, Phone, Clock, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePendingCallRequests } from '@/lib/hooks/usePendingCallRequests'

function formatCountdown(ms: number) {
  if (ms <= 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

export function IncomingCallRequestModal() {
  const [creatorId, setCreatorId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCreatorId(user?.id ?? null)
    })
  }, [])

  const { pending, refetch } = usePendingCallRequests(creatorId)
  const current = pending[0] ?? null

  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!current) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [current])

  const countdownMs = useMemo(() => {
    if (!current?.expires_at) return 0
    return new Date(current.expires_at).getTime() - now
  }, [current, now])

  if (!current) return null

  const handleAccept = async () => {
    if (!current || busy) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('one_on_one_calls')
        .update({ status: 'awaiting_payment', accepted_at: new Date().toISOString() })
        .eq('id', current.id)

      if (error) {
        // Exclusividade 1-a-1: o trigger recusa aceitar uma 2ª chamada
        // enquanto outra já está ativa.
        toast.error(
          error.message.includes('creator_busy')
            ? 'Você já está em outra videochamada. Finalize-a antes de aceitar outra.'
            : 'Não foi possível aceitar: ' + error.message,
        )
      } else {
        toast.success('Videochamada aceita — aguardando pagamento')
        await refetch()
      }
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!current || busy) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('one_on_one_calls')
        .update({ status: 'rejected', rejected_at: new Date().toISOString() })
        .eq('id', current.id)

      if (error) {
        toast.error('Não foi possível recusar: ' + error.message)
      } else {
        toast('Solicitação recusada')
        await refetch()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-6 shadow-[0_12px_48px_rgba(0,0,0,0.4)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <Video size={22} />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Nova solicitação de videochamada
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
            <Clock size={14} />
            {formatCountdown(countdownMs)}
          </span>
        </div>

        <div className="mb-5">
          <p className="text-lg font-semibold text-[var(--color-foreground)]">
            {current.user?.full_name ?? 'Cliente'}
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Quer uma videochamada de{' '}
            <strong>{current.scheduled_duration_minutes} min</strong> por{' '}
            <strong>
              {(current.currency ?? 'BRL')}{' '}
              {Number(current.call_price).toFixed(2).replace('.', ',')}
            </strong>
            .
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReject}
            disabled={busy}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-3 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <X size={16} /> Recusar
            </span>
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={busy || countdownMs <= 0}
            className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow transition-opacity disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2 justify-center">
              <Phone size={16} /> Aceitar
            </span>
          </button>
        </div>

        {pending.length > 1 && (
          <p className="mt-3 text-center text-xs text-[var(--color-muted-foreground)]">
            +{pending.length - 1} solicitação(ões) aguardando
          </p>
        )}
      </div>
    </div>
  )
}
