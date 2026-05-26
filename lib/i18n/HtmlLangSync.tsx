'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store/app-store'
import { getLocaleBcp47 } from '@/lib/i18n'

/**
 * Sincroniza o atributo `lang` do <html> com o locale ativo no Zustand.
 * Deve ser incluído uma vez no Providers.
 */
export default function HtmlLangSync() {
  const locale = useAppStore((s) => s.locale)

  useEffect(() => {
    document.documentElement.lang = getLocaleBcp47(locale)
  }, [locale])

  return null
}
