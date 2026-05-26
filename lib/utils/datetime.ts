/**
 * Formatação de data/hora respeitando o locale do usuário.
 * Brasil (pt-BR): 24h. EUA (en-US): 12h AM/PM. Outros: conforme o locale do navegador.
 */

function getDefaultLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'pt-BR'
}

/**
 * Formata apenas a hora (e minuto). Usa o padrão do locale: 24h no Brasil, 12h AM/PM em en-US, etc.
 */
export function formatTimeLocal(
  value: Date | string | null | undefined,
  locale?: string
): string {
  if (value == null) return '--:--'
  let d: Date
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // HH:mm ou HH:mm:ss (hora isolada, usa hoje para criar Date)
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const [h, m] = trimmed.split(':').map(Number)
      d = new Date()
      d.setHours(h, m, 0, 0)
    } else {
      d = new Date(value)
    }
  } else {
    d = value
  }
  if (isNaN(d.getTime())) return '--:--'
  const loc = locale ?? getDefaultLocale()
  return new Intl.DateTimeFormat(loc, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/**
 * Formata data no formato curto do locale (ex.: dd/MM/yyyy ou MM/dd/yyyy).
 */
export function formatDateLocal(
  value: Date | string | null | undefined,
  locale?: string
): string {
  if (value == null) return '--/--/----'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '--/--/----'
  const loc = locale ?? getDefaultLocale()
  return new Intl.DateTimeFormat(loc, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/**
 * Retorna a data de hoje no formato YYYY-MM-DD (timezone local).
 */
export function getTodayLocalYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Retorna a data de amanhã no formato YYYY-MM-DD (timezone local).
 */
export function getTomorrowLocalYYYYMMDD(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Dado start_date (YYYY-MM-DD) e time (HH:mm ou HH:mm:ss) em UTC (como na vw_creator_events),
 * retorna a data no fuso local do usuário em YYYY-MM-DD.
 */
export function eventStartDateLocal(startDate: string | null, time: string | null): string {
  if (!startDate) return ''
  const timePart = (time || '00:00').slice(0, 5)
  const iso = `${startDate}T${timePart}:00.000Z`
  const d = new Date(iso)
  if (isNaN(d.getTime())) return startDate
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Retorna a chave de dia no formato DD/MM/YYYY (data local) para um evento da vw_creator_events,
 * para agrupar/filtrar por "dia do evento" no fuso do usuário.
 */
export function eventDateKeyLocal(startDate: string | null, time: string | null): string {
  const ymd = eventStartDateLocal(startDate, time)
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Formata data e hora no locale do usuário.
 */
export function formatDateTimeLocal(
  value: Date | string | null | undefined,
  locale?: string
): string {
  if (value == null) return '--'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '--'
  const loc = locale ?? getDefaultLocale()
  return new Intl.DateTimeFormat(loc, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
