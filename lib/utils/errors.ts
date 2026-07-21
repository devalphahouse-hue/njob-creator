/**
 * Extração de mensagem de erro resiliente.
 *
 * PostgrestError herda de Error nas versões atuais do supabase-js, então
 * `err instanceof Error` funciona hoje. Mas erros de rede, de Edge Function ou
 * de versões futuras da lib podem chegar como objeto simples — e aí o
 * `instanceof` falha silenciosamente, a detecção de casos específicos (ex.:
 * cooldown de exclusão) se perde e o usuário recebe um erro genérico inútil.
 * Foi exatamente esse o risco que motivou este helper.
 */
export function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

/**
 * Lê os dias restantes de `deletion_cooldown_active:<n>`, levantado por
 * fn_request_account_deletion. Retorna null quando o erro é outro.
 * Sem âncora `^`: PostgREST pode prefixar a mensagem.
 */
export function parseDeletionCooldown(message: string): number | null {
  const match = message.match(/deletion_cooldown_active:(\d+)/)
  return match ? Number(match[1]) : null
}

/** Dias restantes até `until`, no mesmo arredondamento do SQL: GREATEST(1, CEIL(...)). */
export function daysUntil(until: string | null | undefined): number | null {
  if (!until) return null
  const ms = new Date(until).getTime() - Date.now()
  if (Number.isNaN(ms) || ms <= 0) return null
  return Math.max(1, Math.ceil(ms / 86_400_000))
}
