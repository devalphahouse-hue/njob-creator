// Janelas de tempo de videochamadas e presença — fonte única de verdade.
// Antes estavam duplicadas inline em video-call/[id]/page.tsx,
// app/api/zego-token/route.ts, usePaidCalls.ts, CreatorPresenceShell.tsx e
// DetalhesAgendamentoModal.tsx — com um default divergente (?? 30 vs ?? 60)
// que podia liberar a entrada no cliente e negar o token no servidor.

/**
 * Janela para entrar numa videochamada paga: igual à duração comprada,
 * contada a partir de paid_at. 30 min comprados → 30 min pra entrar.
 * Mantém em sincronia com client_web (timeWindows.ts) e a edge function
 * generate-zego-token (server-side gate).
 */
export function getPaidCallWindowMs(durationMinutes: number): number {
  return durationMinutes * 60 * 1000
}

/** Carência após o fim de uma chamada agendada (fluxo legado 'confirmed'). */
export const LEGACY_CALL_GRACE_MS = 5 * 60 * 1000

/** Antecedência permitida para entrar numa chamada agendada (legado). */
export const CALL_ENTRY_BUFFER_MS = 5 * 60 * 1000

/** Duração padrão de uma chamada (min) quando scheduled_duration_minutes é null. */
export const DEFAULT_CALL_DURATION_MIN = 60

/** Tempo de inatividade do creator antes de cair para offline. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000
