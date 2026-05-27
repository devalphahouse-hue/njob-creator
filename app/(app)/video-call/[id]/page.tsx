'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCreator } from '@/lib/store/app-store'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { observeZegoTranslation } from '@/lib/zego-i18n'
import {
  PAID_CALL_WINDOW_MS,
  LEGACY_CALL_GRACE_MS,
  DEFAULT_CALL_DURATION_MIN,
} from '@/lib/constants/call-windows'

type Status = 'loading' | 'error' | 'joined'

export default function VideoCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const creator = useCreator()

  const { t, locale } = useTranslation()

  const containerRef = useRef<HTMLDivElement>(null)
  const zegoRef = useRef<unknown>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endedRef = useRef(false)
  const [status, setStatus] = useState<Status>('loading')

  // Traduz a UI do ZegoCloud UIKit (SDK só vem em en/zh).
  useEffect(() => {
    if (!containerRef.current) return
    return observeZegoTranslation(containerRef.current, locale)
  }, [locale])

  useEffect(() => {
    if (!creator || !id || !containerRef.current) return

    let cancelled = false
    endedRef.current = false

    // Encerra a sala quando a duração comprada acaba. Idempotente.
    const endCall = () => {
      if (endedRef.current) return
      endedRef.current = true
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      void supabase
        .from('one_on_one_calls')
        .update({ status: 'completed', actual_end_time: new Date().toISOString() })
        .eq('id', id)
      if (zegoRef.current) {
        try {
          (zegoRef.current as { destroy: () => void }).destroy()
        } catch {
          /* noop */
        }
        zegoRef.current = null
      }
      toast.info('Tempo da videochamada encerrado.')
      router.push('/home')
    }

    async function initCall() {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id
      if (!userId) {
        setStatus('error')
        return
      }

      // Busca dados da chamada
      const { data: call } = await supabase
        .from('one_on_one_calls')
        .select(
          'id, creator_id, status, paid_at, scheduled_start_time, scheduled_duration_minutes',
        )
        .eq('id', id)
        .single()

      if (!call || call.creator_id !== userId) {
        setStatus('error')
        return
      }

      // Só entra se a call estiver paga (fluxo novo) ou confirmed (legado).
      if (call.status !== 'paid' && call.status !== 'confirmed') {
        setStatus('error')
        return
      }

      const now = Date.now()

      if (call.status === 'paid') {
        const paidAt = call.paid_at ? new Date(call.paid_at).getTime() : NaN
        if (!isFinite(paidAt) || now > paidAt + PAID_CALL_WINDOW_MS) {
          setStatus('error')
          return
        }
      } else if (call.status === 'confirmed' && call.scheduled_start_time) {
        const startTime = new Date(call.scheduled_start_time).getTime()
        const durationMs =
          (call.scheduled_duration_minutes ?? DEFAULT_CALL_DURATION_MIN) * 60 * 1000
        const endTime = startTime + durationMs
        if (now > endTime + LEGACY_CALL_GRACE_MS) {
          setStatus('error')
          return
        }
      }

      if (cancelled) return

      // Import dinâmico para evitar SSR
      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')

      const userName = creator!.profile.full_name || 'Creator'

      // Gerar token via API route (server-side, sem expor secrets)
      const tokenRes = await fetch('/api/zego-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomID: id, userID: userId, userName }),
      })
      if (!tokenRes.ok) { setStatus('error'); return }
      const { token: kitToken } = await tokenRes.json()

      const zp = ZegoUIKitPrebuilt.create(kitToken)
      zegoRef.current = zp

      zp.joinRoom({
        container: containerRef.current!,
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall,
        },
        showPreJoinView: false,
        showLeavingView: false,
        showRoomTimer: true,
        turnOnCameraWhenJoining: true,
        turnOnMicrophoneWhenJoining: true,
        onLeaveRoom: () => {
          const nowIso = new Date().toISOString()
          // Marca como completed ao sair (creator-side trigger permite paid/confirmed → completed)
          void supabase
            .from('one_on_one_calls')
            .update({
              status: 'completed',
              actual_end_time: nowIso,
            })
            .eq('id', id)
          router.push('/home')
        },
      })

      // Marca/lê o início real via RPC (idempotente, bypassa RLS, retorna o
      // timestamp canônico de quem entrou primeiro). Fallback p/ agora se falhar.
      const { data: startedIso } = await supabase.rpc('fn_mark_call_started', {
        p_call_id: id,
      })
      const startMs = startedIso ? new Date(startedIso as string).getTime() : Date.now()
      const durationMin = call.scheduled_duration_minutes ?? DEFAULT_CALL_DURATION_MIN
      const endAt = startMs + durationMin * 60_000

      let warned = false
      timerRef.current = setInterval(() => {
        const remaining = endAt - Date.now()
        if (remaining <= 60_000 && remaining > 0 && !warned) {
          warned = true
          toast.warning('A videochamada encerra em 1 minuto.')
        }
        if (remaining <= 0) endCall()
      }, 1000)

      setStatus('joined')
    }

    initCall().catch(() => {
      if (!cancelled) setStatus('error')
    })

    return () => {
      cancelled = true
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (zegoRef.current) {
        (zegoRef.current as { destroy: () => void }).destroy()
        zegoRef.current = null
      }
    }
  }, [creator, id, supabase, router])

  return (
    <>
      {/* Error overlay */}
      {status === 'error' && (
        <div className="fixed inset-0 z-[60] bg-[var(--color-background)] flex flex-col items-center justify-center gap-4">
          <p className="text-[var(--color-muted)] text-sm">{t('videoCall.errorLoad')}</p>
          <button
            onClick={() => router.push('/home')}
            className="px-6 py-2 rounded-xl bg-[var(--color-primary)] text-white border-none cursor-pointer text-sm font-semibold"
          >
            {t('common.back')}
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="fixed inset-0 z-[60] bg-[var(--color-background)] flex flex-col items-center justify-center gap-4">
          <div className="size-12 rounded-full bg-[rgba(101,22,147,0.1)] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#651693" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <p className="text-[var(--color-muted)] text-sm">{t('videoCall.connecting')}</p>
        </div>
      )}

      {/* Container persistente do ZegoCloud */}
      <div className="fixed inset-0 z-50 bg-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </>
  )
}
