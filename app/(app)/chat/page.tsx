'use client'

import { useTranslation } from '@/lib/i18n'

// Painel direito quando nenhuma conversa está selecionada. No desktop mostra o
// placeholder ao lado da lista; no mobile fica oculto (o layout exibe a lista).
export default function ChatPlaceholderPage() {
  const { t } = useTranslation()
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
      <div className="text-4xl">💬</div>
      <p className="text-sm text-[var(--color-muted)] max-w-xs">
        {t('chat.selectConversation')}
      </p>
    </div>
  )
}
