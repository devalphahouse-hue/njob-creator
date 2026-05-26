'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCreator } from '@/lib/store/app-store'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { observeZegoTranslation } from '@/lib/zego-i18n'

type Status = 'loading' | 'error' | 'not-owner' | 'joined'

export default function LiveHostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const creator = useCreator()

  const { t, locale } = useTranslation()

  const containerRef = useRef<HTMLDivElement>(null)
  const zegoRef = useRef<unknown>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endedRef = useRef(false)
  const isLiveRef = useRef(false)
  const [status, setStatus] = useState<Status>('loading')

  // Traduz a UI do ZegoCloud UIKit (SDK só vem em en/zh). isLiveRef faz o botão
  // "Iniciar Live" virar "Finalizar" enquanto a transmissão está no ar.
  useEffect(() => {
    if (!containerRef.current) return
    return observeZegoTranslation(containerRef.current, locale, isLiveRef)
  }, [locale])

  useEffect(() => {
    if (!creator || !id || !containerRef.current) return

    let cancelled = false
    endedRef.current = false

    // Encerra a live quando a duração comprada acaba. Idempotente.
    const endLive = () => {
      if (endedRef.current) return
      endedRef.current = true
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      void supabase
        .from('live_streams')
        .update({ status: 'finished', actual_end_time: new Date().toISOString() })
        .eq('id', id)
      if (zegoRef.current) {
        try {
          (zegoRef.current as { destroy: () => void }).destroy()
        } catch {
          /* noop */
        }
        zegoRef.current = null
      }
      toast.info('Tempo da live encerrado.')
      router.push('/home')
    }

    async function initLive() {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id
      if (!userId) {
        setStatus('error')
        return
      }

      // Valida que o creator é dono do evento
      const { data: live } = await supabase
        .from('live_streams')
        .select('id, creator_id, estimated_duration_minutes')
        .eq('id', id)
        .single()

      if (!live || live.creator_id !== userId) {
        setStatus('not-owner')
        return
      }

      if (cancelled) return

      // Import dinâmico para evitar SSR
      const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')

      const userName = creator!.profile.full_name || 'Host'

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
          mode: ZegoUIKitPrebuilt.LiveStreaming,
          config: {
            role: ZegoUIKitPrebuilt.Host,
          },
        },
        showPreJoinView: false,
        showLeavingView: false,
        showRoomTimer: true,
        turnOnCameraWhenJoining: true,
        turnOnMicrophoneWhenJoining: true,
        onLiveStart: () => {
          isLiveRef.current = true
        },
        onLiveEnd: () => {
          isLiveRef.current = false
        },
        onLeaveRoom: () => {
          router.push('/home')
        },
      })

      // Marca o início real da live (host) via RPC e arma o timer de
      // encerramento em actual_start_time + duração estimada (30/60 min).
      const { data: startedIso } = await supabase.rpc('fn_mark_live_started', {
        p_live_stream_id: id,
      })
      const startMs = startedIso ? new Date(startedIso as string).getTime() : Date.now()
      const durationMin = live.estimated_duration_minutes ?? 60
      const endAt = startMs + durationMin * 60_000

      let warned = false
      timerRef.current = setInterval(() => {
        const remaining = endAt - Date.now()
        if (remaining <= 60_000 && remaining > 0 && !warned) {
          warned = true
          toast.warning('A live encerra em 1 minuto.')
        }
        if (remaining <= 0) endLive()
      }, 1000)

      setStatus('joined')
    }

    initLive().catch((err) => {
      console.error('[LIVE] initLive error:', err)
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
      {/* Error / not-owner overlay */}
      {(status === 'error' || status === 'not-owner') && (
        <div className="fixed inset-0 z-[60] bg-[var(--color-background)] flex flex-col items-center justify-center gap-4">
          <p className="text-[var(--color-muted)] text-sm">
            {status === 'not-owner' ? t('live.notOwner') : t('live.errorLoad')}
          </p>
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
          <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="2" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
            </svg>
          </div>
          <p className="text-[var(--color-muted)] text-sm">{t('live.connecting')}</p>
        </div>
      )}

      {/* Container persistente do ZegoCloud — nunca é desmontado */}
      <div className="fixed inset-0 z-50 bg-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </>
  )
}
