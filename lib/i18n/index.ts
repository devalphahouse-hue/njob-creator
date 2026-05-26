import { useAppStore } from '@/lib/store/app-store'
import pt, { type Translations } from './translations/pt'
import en from './translations/en'
import es from './translations/es'

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type Locale = 'pt' | 'en' | 'es'

/** Gera union de chaves pontilhadas a partir do objeto de traduções */
type FlattenKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? FlattenKeys<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`
}[keyof T & string]

export type TranslationKey = FlattenKeys<Translations>

// ─── Mapa de traduções ─────────────────────────────────────────────────────

const translations: Record<Locale, Translations> = { pt, en, es }

// ─── Locale → BCP-47 (para Intl / toLocaleString) ─────────────────────────

const bcp47Map: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
}

export function getLocaleBcp47(locale: Locale): string {
  return bcp47Map[locale]
}

// ─── Resolver chave pontilhada no objeto ───────────────────────────────────

function resolve(obj: Translations, key: string): string {
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return key
    cur = cur[part]
  }
  return typeof cur === 'string' ? cur : key
}

// ─── Interpolação {param} ──────────────────────────────────────────────────

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useTranslation() {
  const locale = useAppStore((s) => s.locale)
  const dict = translations[locale]

  function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const raw = resolve(dict, key)
    return interpolate(raw, params)
  }

  return { t, locale } as const
}
