import type { SupabaseClient } from '@supabase/supabase-js'
import { daysUntil } from '@/lib/utils/errors'

const MAX_RETRIES = 3

export interface CancelDeletionNotifier {
  /** Exclusão cancelada com sucesso; `days` = cooldown carimbado (null se ausente). */
  onCanceled: (days: number | null) => void
  /** A conta estava pendente mas o cancelamento falhou depois das tentativas. */
  onFailed: () => void
}

/**
 * Cancela uma exclusão pendente — SOMENTE após um login EXPLÍCITO.
 *
 * Antes isso rodava na montagem do app (CreatorLoader), o que significava que
 * QUALQUER abertura com sessão válida cancelava a exclusão. Cenário real: o
 * creator exclui a conta no desktop (e é deslogado lá), mas segue logado no
 * celular; ao abrir o app no celular a exclusão era desfeita sem ele pedir, e
 * ainda queimava o cooldown de 7 dias. A regra de negócio é "se ele logar
 * novamente", então o gatilho tem que ser o login de verdade.
 *
 * Falha aqui é relevante: se o cancelamento não gravar, a conta continua na fila
 * e o pg_cron a anonimiza aos 30 dias. Por isso tenta várias vezes e avisa o
 * usuário se não conseguir, em vez de falhar em silêncio.
 */
export async function cancelPendingDeletionOnLogin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  notify: CancelDeletionNotifier,
): Promise<void> {
  // NUNCA propaga exceção: esta função roda no meio do fluxo de login, antes do
  // gate de Stripe. Se ela lançar, o runAuthGate rejeita, o setLoading(false)
  // nunca acontece e o botão "Entrar" fica girando para sempre — o usuário fica
  // sem conseguir entrar por causa de uma funcionalidade secundária.
  try {
    await runCancelPendingDeletion(supabase, notify)
  } catch (err) {
    console.warn('[account-deletion] falha inesperada no cancelamento:', err)
    notify.onFailed()
  }
}

async function runCancelPendingDeletion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  notify: CancelDeletionNotifier,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return

  const { data: before } = await supabase
    .from('profiles')
    .select('deletion_requested_at, deleted_at')
    .eq('id', user.id)
    .maybeSingle()

  // Nada pendente: não gasta RPC nem corre risco de avisar à toa.
  if (!before?.deletion_requested_at || before.deleted_at) return

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { error } = await supabase.rpc('fn_cancel_account_deletion')
    if (!error) {
      // O cancelamento carimba um cooldown de 7 dias. Avisamos na hora — antes o
      // usuário só descobria o bloqueio dias depois, ao tentar excluir de novo.
      const { data: after } = await supabase
        .from('profiles')
        .select('deletion_cooldown_until')
        .eq('id', user.id)
        .maybeSingle()
      notify.onCanceled(daysUntil(after?.deletion_cooldown_until))
      return
    }
    console.warn(`[account-deletion] cancelamento ${attempt}/${MAX_RETRIES} falhou:`, error)
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * attempt))
    }
  }

  notify.onFailed()
}
