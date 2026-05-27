// Janelas de tempo de videochamadas e presença — fonte única de verdade.
// Antes estavam duplicadas inline em video-call/[id]/page.tsx,
// app/api/zego-token/route.ts, usePaidCalls.ts, CreatorPresenceShell.tsx e
// DetalhesAgendamentoModal.tsx — com um default divergente (?? 30 vs ?? 60)
// que podia liberar a entrada no cliente e negar o token no servidor.

/** Janela para entrar numa videochamada paga, contada a partir de paid_at. */
export const PAID_CALL_WINDOW_MS = 2 * 60 * 60 * 1000

/** Carência após o fim de uma chamada agendada (fluxo legado 'confirmed'). */
export const LEGACY_CALL_GRACE_MS = 5 * 60 * 1000

/** Antecedência permitida para entrar numa chamada agendada (legado). */
export const CALL_ENTRY_BUFFER_MS = 5 * 60 * 1000

/** Duração padrão de uma chamada (min) quando scheduled_duration_minutes é null. */
export const DEFAULT_CALL_DURATION_MIN = 60

/** Tempo de inatividade do creator antes de cair para offline. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000
