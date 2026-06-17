'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/database'
import { useTranslation } from '@/lib/i18n'
import { ArrowLeft, Send, Check, CheckCheck } from 'lucide-react'

type MessageRow = Database['public']['Views']['vw_messages']['Row']
type ConversationRow = Database['public']['Views']['vw_creator_conversations']['Row']

// Paginação estilo WhatsApp: carrega as N mais recentes e busca lotes antigos
// conforme o usuário rola para o topo.
const PAGE_SIZE = 30

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(date, now)) return '_TODAY_'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(date, yesterday)) return '_YESTERDAY_'
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isSameDay(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  const initials = (name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
  return (
    <div className="relative w-11 h-11 shrink-0">
      {url ? (
        <img src={url} alt={name ?? ''} className="w-11 h-11 rounded-full object-cover" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-semibold">
          {initials}
        </div>
      )}
    </div>
  )
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px bg-[var(--color-border)]" />
      <span className="text-xs text-[var(--color-muted)] shrink-0">{label}</span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  )
}

function MessageBubble({ msg, isMine }: { msg: MessageRow; isMine: boolean }) {
  // Aqui o "eu" é o creator. Check duplo na MINHA mensagem aparece quando o
  // cliente leu. A view vw_messages expõe is_read_by_client/is_read_by_creator
  // pareando com os participantes da conversa, então is_read_by_client é o
  // sinal correto para o creator. (No client_web é o oposto.)
  const isRead = !!msg.is_read_by_client

  if (isMine) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl px-4 pt-3 pb-2 bg-[var(--color-primary)]">
          <p className="text-white text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {msg.content ?? ''}
          </p>
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[11px] text-white/70">{formatTime(msg.created_at)}</span>
            {isRead ? (
              <CheckCheck className="w-3 h-3 text-white/70" />
            ) : (
              <Check className="w-3 h-3 text-white/70" />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[72%] rounded-tl-sm rounded-tr-2xl rounded-bl-2xl rounded-br-2xl px-4 pt-3 pb-2 bg-[var(--color-surface-2)]">
        <p className="text-[var(--color-foreground)] text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {msg.content ?? ''}
        </p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[11px] text-[var(--color-muted)]">{formatTime(msg.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Conversation ───────────────────────────────────────────────────────────────

export default function ChatConversationPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [peerName, setPeerName] = useState<string>('')
  const [peerAvatarUrl, setPeerAvatarUrl] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Meu cleared_at nesta conversa: oculta mensagens anteriores à exclusão.
  const clearedAtRef = useRef<string | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior }), 60)
  }, [])

  // Está perto do fim? (decide se auto-rola ao chegar mensagem nova)
  const isNearBottom = useCallback((): boolean => {
    const c = scrollRef.current
    if (!c) return true
    return c.scrollHeight - c.scrollTop - c.clientHeight < 120
  }, [])

  const applyClearedFilter = useCallback((rows: MessageRow[]): MessageRow[] => {
    const cleared = clearedAtRef.current
    if (!cleared) return rows
    const clearedMs = new Date(cleared).getTime()
    return rows.filter((m) => !!m.created_at && new Date(m.created_at).getTime() > clearedMs)
  }, [])

  // Mescla lotes por message_id mantendo ordem cronológica; preserva o histórico
  // já carregado ao paginar e atualiza recibos de leitura na janela recente.
  const mergeRows = useCallback((incoming: MessageRow[]) => {
    setMessages((prev) => {
      const map = new Map<string, MessageRow>()
      for (const m of prev) if (m.message_id) map.set(m.message_id, m)
      for (const m of incoming) if (m.message_id) map.set(m.message_id, m)
      return Array.from(map.values()).sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return ta - tb
      })
    })
  }, [])

  // Carga inicial: PAGE_SIZE mais recentes (substitui a lista).
  const loadInitial = useCallback(async () => {
    if (!id) return
    let q = supabase
      .from('vw_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (clearedAtRef.current) q = q.gt('created_at', clearedAtRef.current)
    const { data, error } = await q
    if (error) {
      console.error('[Chat]', error)
      setMessages([])
      setHasMoreOlder(false)
      return
    }
    const rawDesc = (data ?? []) as MessageRow[]
    setHasMoreOlder(rawDesc.length === PAGE_SIZE)
    setMessages(rawDesc.slice().reverse())
  }, [id, supabase])

  // Sincroniza só a janela recente e mescla (poll + realtime), sem descartar o
  // histórico já carregado nem mexer no scroll do usuário.
  const syncRecent = useCallback(async () => {
    if (!id) return
    let q = supabase
      .from('vw_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (clearedAtRef.current) q = q.gt('created_at', clearedAtRef.current)
    const { data, error } = await q
    if (error) return
    const rawDesc = (data ?? []) as MessageRow[]
    mergeRows(applyClearedFilter(rawDesc.slice().reverse()))
  }, [id, supabase, mergeRows, applyClearedFilter])

  // Carrega lote mais antigo ao rolar para o topo, preservando a posição.
  const loadOlder = useCallback(async () => {
    if (!id || isLoadingOlder || !hasMoreOlder) return
    const oldest = messages[0]?.created_at
    if (!oldest) return
    setIsLoadingOlder(true)
    const container = scrollRef.current
    const prevHeight = container?.scrollHeight ?? 0
    const prevTop = container?.scrollTop ?? 0
    let q = supabase
      .from('vw_messages')
      .select('*')
      .eq('conversation_id', id)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (clearedAtRef.current) q = q.gt('created_at', clearedAtRef.current)
    const { data, error } = await q
    if (!error) {
      const rawDesc = (data ?? []) as MessageRow[]
      setHasMoreOlder(rawDesc.length === PAGE_SIZE)
      if (rawDesc.length > 0) {
        mergeRows(rawDesc)
        requestAnimationFrame(() => {
          const c = scrollRef.current
          if (c) c.scrollTop = c.scrollHeight - prevHeight + prevTop
        })
      }
    }
    setIsLoadingOlder(false)
  }, [id, isLoadingOlder, hasMoreOlder, messages, supabase, mergeRows])

  const handleScroll = useCallback(() => {
    const c = scrollRef.current
    if (!c) return
    if (c.scrollTop <= 60 && hasMoreOlder && !isLoadingOlder) {
      void loadOlder()
    }
  }, [hasMoreOlder, isLoadingOlder, loadOlder])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id
      if (!uid) return
      if (!cancelled) setUserId(uid)
      const { data: conv } = await supabase
        .from('vw_creator_conversations')
        .select('peer_name, peer_avatar_url')
        .eq('conversation_id', id)
        .eq('profile_id', uid)
        .single()
      const row = conv as Pick<ConversationRow, 'peer_name' | 'peer_avatar_url'> | null
      if (!cancelled) {
        setPeerName(row?.peer_name ?? '')
        setPeerAvatarUrl(row?.peer_avatar_url ?? null)
      }
      const { data: part } = await supabase
        .from('conversation_participants')
        .select('cleared_at')
        .eq('conversation_id', id)
        .eq('profile_id', uid)
        .maybeSingle()
      clearedAtRef.current = (part as { cleared_at: string | null } | null)?.cleared_at ?? null
      await loadInitial()
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', id)
        .eq('profile_id', uid)
      // Atualiza a lista + o badge de não lidas (prefixo vw_creator_conversations).
      queryClient.invalidateQueries({ queryKey: ['vw_creator_conversations'] })
      if (!cancelled) {
        setLoading(false)
        scrollToBottom('auto')
      }
    })()
    return () => { cancelled = true }
  }, [id, supabase, loadInitial, scrollToBottom, queryClient])

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          // Só auto-rola se já estava perto do fim (ou se a msg é minha), para
          // não interromper a leitura de mensagens antigas paginadas.
          const raw = payload.new as { sender_id?: string } | null
          const stick = isNearBottom() || raw?.sender_id === userId
          void syncRecent().then(() => {
            if (stick) scrollToBottom()
          })
          // Conversa aberta: a mensagem que chega já está sendo "lida" — marca
          // last_read_at e atualiza a lista/badge para não contar como não lida.
          if (raw?.sender_id && raw.sender_id !== userId && userId) {
            void supabase
              .from('conversation_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', id)
              .eq('profile_id', userId)
              .then(() =>
                queryClient.invalidateQueries({ queryKey: ['vw_creator_conversations'] }),
              )
          }
        },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn(`[chat-realtime] ${id}:`, status)
        }
      })
    // Fallback contra Realtime quebrado: poll a cada 4s para garantir que
    // mensagens novas do outro lado apareçam mesmo se postgres_changes falhar.
    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncRecent()
      }
    }, 4000)
    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(pollId)
    }
  }, [id, supabase, syncRecent, scrollToBottom, isNearBottom, userId, queryClient])

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending || !userId || !id) return
    setSending(true)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: userId,
      content: text,
    })
    setSending(false)
    if (error) {
      console.error('[Chat] send', error)
      setInput(text)
      return
    }
    await syncRecent()
    scrollToBottom()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!id) return null

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto w-full">
          <button
            type="button"
            onClick={() => router.push('/chat')}
            aria-label={t('common.back')}
            className="md:hidden bg-transparent border-none cursor-pointer p-1.5 -ml-1.5 rounded-full"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <Avatar url={peerAvatarUrl} name={peerName} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--color-foreground)] truncate">
              {peerName || t('chat.title')}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {isLoadingOlder && (
            <div className="flex justify-center py-3">
              <div className="w-5 h-5 border-2 border-[var(--color-muted)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {loading ? (
            <div className="p-6 text-center text-[var(--color-muted)]">{t('common.loading')}</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-16">
              <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
                <Send className="w-6 h-6 text-[var(--color-muted)]" />
              </div>
              <p className="text-[var(--color-muted)] text-sm">{t('chat.noMessages')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((msg, index) => {
                const isMine = msg.sender_id === userId
                const prevMsg = messages[index - 1] ?? null
                const showDivider = index === 0 || !isSameDay(prevMsg?.created_at ?? null, msg.created_at)
                return (
                  <div key={msg.message_id ?? index}>
                    {showDivider && (
                      <DateDivider
                        label={formatDateLabel(msg.created_at)
                          .replace('_TODAY_', t('chat.today'))
                          .replace('_YESTERDAY_', t('chat.yesterday'))}
                      />
                    )}
                    <MessageBubble msg={msg} isMine={isMine} />
                  </div>
                )
              })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-[var(--color-border)]">
        <div className="flex items-end gap-3 px-4 py-3 max-w-3xl mx-auto w-full">
          <div className="flex-1 flex items-end bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl px-4 py-2.5 min-h-[44px]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.messagePlaceholder')}
              className="flex-1 bg-transparent resize-none outline-none text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] leading-relaxed max-h-[120px] overflow-y-auto"
            />
          </div>
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || sending}
            aria-label={t('chat.send')}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-none cursor-pointer transition-all disabled:cursor-not-allowed"
            style={{ background: input.trim() && !sending ? 'var(--color-primary)' : 'var(--color-surface-2)' }}
          >
            <Send className="w-4 h-4" style={{ color: input.trim() ? '#fff' : 'var(--color-muted)' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
