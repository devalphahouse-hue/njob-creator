'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Video, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePaidCalls } from '@/lib/hooks/usePaidCalls'

/**
 * Banner flutuante no creator exibindo chamadas pagas disponíveis pra entrar.
 * Aparece automaticamente (via realtime + polling) quando o cliente paga.
 */
export function ActiveCallCTA() {
  const router = useRouter()
  const pathname = usePathname()
  const [creatorId, setCreatorId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCreatorId(user?.id ?? null)
    })
  }, [])

  const { calls } = usePaidCalls(creatorId)
  const current = calls[0] ?? null

  // Não mostra o banner "Entrar" quando o creator já está dentro de uma sala.
  if (pathname?.startsWith('/video-call')) return null
  if (!current) return null

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 md:left-[calc(50%+7.5rem)] z-[60] w-[calc(100%-2rem)] max-w-md">
      <div className="rounded-2xl bg-[var(--color-primary)] text-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Video size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide opacity-80">Videochamada paga</p>
          <p className="text-sm font-semibold truncate">
            {current.user?.full_name ?? 'Cliente'} está aguardando
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/video-call/${current.id}`)}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-[var(--color-primary)] px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-colors"
        >
          <Phone size={14} /> Entrar
        </button>
      </div>
    </div>
  )
}
