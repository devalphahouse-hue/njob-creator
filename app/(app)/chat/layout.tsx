'use client'

import { usePathname } from 'next/navigation'
import ConversationList from './_components/ConversationList'

// Master-detail estilo WhatsApp Web: lista à esquerda (sempre visível no
// desktop) + conversa à direita. No mobile mostra um painel por vez: lista em
// /chat, conversa em /chat/[id].
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const match = pathname.match(/^\/chat\/([^/]+)/)
  const selectedId = match ? decodeURIComponent(match[1]) : undefined
  const hasSelection = !!selectedId

  return (
    <div className="flex h-full min-h-0 rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
      {/* Painel esquerdo: lista */}
      <aside
        className={`${
          hasSelection ? 'hidden md:flex' : 'flex'
        } w-full md:w-[340px] shrink-0 flex-col border-r border-[var(--color-border)]`}
      >
        <ConversationList selectedId={selectedId} />
      </aside>

      {/* Painel direito: conversa ou placeholder (children) */}
      <section className={`${hasSelection ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col`}>
        {children}
      </section>
    </div>
  )
}
