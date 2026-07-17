'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useTranslation, getLocaleBcp47 } from '@/lib/i18n'
import { getTodayLocalYYYYMMDD } from '@/lib/utils/datetime'
import { MIN_PRICE_BRL } from '@/lib/constants/pricing'

// Opcoes de duracao — espelham FFAppConstants.DURACAO do Flutter
type DuracaoOption = '1hora' | '30min'

const DURACAO_MINUTOS: Record<DuracaoOption, number> = {
  '1hora': 60,
  '30min': 30,
}

// Valor enviado ao backend (preserva o formato original da Edge Function)
const DURACAO_BACKEND_VALUE: Record<DuracaoOption, string> = {
  '1hora': '1 hora',
  '30min': '30 minutos',
}

// ─── Ícones ───────────────────────────────────────────────────────

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
)

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const SpinnerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2a10 10 0 0 1 10 10" style={{ animation: 'novoEventoSpin 0.7s linear infinite' }} />
  </svg>
)

// ─── Helpers ──────────────────────────────────────────────────────

function parseCurrencyBRL(raw: string): number {
  const cleaned = raw.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function formatCurrencyBRL(raw: string, bcp47 = 'pt-BR'): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(num)
}

function formatZeroCurrency(bcp47 = 'pt-BR'): string {
  return new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(0)
}

function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

function formatDateDisplay(d: Date | null, selectDateLabel: string): string {
  if (!d) return selectDateLabel
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

// ─── Keyframes ────────────────────────────────────────────────────

const modalKeyframes = `
@keyframes novoEventoOverlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes novoEventoModalIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@keyframes novoEventoSpin {
  to { transform: rotate(360deg); }
}
@keyframes novoEventoShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
`

// ─── Componente ───────────────────────────────────────────────────

interface NovoEventoModalProps {
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
  initialDate?: Date | null
}

export default function NovoEventoModal({ isOpen, onClose, onRefresh, initialDate = null }: NovoEventoModalProps) {
  const supabase = createClient()
  const { t, locale } = useTranslation()
  const bcp47 = getLocaleBcp47(locale)

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [duracao, setDuracao] = useState<DuracaoOption>('1hora')
  const [valorRaw, setValorRaw] = useState('')
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(initialDate ?? null)
  const [horario, setHorario] = useState('')

  const [erroTitulo, setErroTitulo] = useState(false)
  const [erroDuracao, setErroDuracao] = useState(false)
  const [erroValor, setErroValor] = useState(false)
  const [erroData, setErroData] = useState(false)
  const [erroHorario, setErroHorario] = useState(false)
  const [shakeFields, setShakeFields] = useState(false)

  const [loading, setLoading] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Fecha com Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Ao abrir: sync data e preencher horário com a hora atual
  useEffect(() => {
    if (isOpen) {
      if (initialDate) setDataSelecionada(initialDate)
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      setHorario(`${hh}:${mm}`)
    }
  }, [isOpen, initialDate])

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setTitulo('')
      setDescricao('')
      setDuracao('1hora')
      setValorRaw('')
      setDataSelecionada(initialDate ?? null)
      setHorario('')
      setErroTitulo(false)
      setErroDuracao(false)
      setErroValor(false)
      setErroData(false)
      setErroHorario(false)
      setShakeFields(false)
      setLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  // ─── Handlers ───────────────────────────────────────────────────

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValorRaw(formatCurrencyBRL(e.target.value, bcp47))
    setErroValor(false)
  }

  const handleValorBlur = () => {
    const num = parseCurrencyBRL(valorRaw)
    if (valorRaw && num < MIN_PRICE_BRL) {
      setErroValor(true)
    }
  }

  const handleHorarioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHorario(maskTime(e.target.value))
    setErroHorario(false)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val) {
      const [year, month, day] = val.split('-').map(Number)
      setDataSelecionada(new Date(year, month - 1, day))
      setErroData(false)
    }
  }

  const openDatePicker = () => {
    dateInputRef.current?.showPicker?.()
    dateInputRef.current?.click()
  }

  const getInputBorderColor = (hasError: boolean) => hasError ? 'var(--color-error)' : 'var(--color-border)'

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'var(--color-primary)'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(174, 50, 195, 0.15)'
  }

  const handleBlurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>, hasError: boolean) => {
    e.currentTarget.style.borderColor = hasError ? 'var(--color-error)' : 'var(--color-border)'
    e.currentTarget.style.boxShadow = 'none'
  }

  const sharedInputClass = 'w-full bg-[var(--color-surface-2)] rounded-[10px] px-3.5 py-[11px] text-[var(--color-foreground)] text-sm outline-none transition-[border-color,box-shadow] duration-150'

  // ─── Submit ─────────────────────────────────────────────────────

  const handleSubmit = async () => {
    let hasError = false

    if (!titulo.trim()) { setErroTitulo(true); hasError = true }
    if (!duracao) { setErroDuracao(true); hasError = true }

    const valorNum = parseCurrencyBRL(valorRaw)
    if (valorNum < MIN_PRICE_BRL) { setErroValor(true); hasError = true }

    if (!dataSelecionada) { setErroData(true); hasError = true }

    const horarioValido = /^\d{2}:\d{2}$/.test(horario)
    if (!horarioValido) { setErroHorario(true); hasError = true }

    if (hasError) {
      setShakeFields(true)
      setTimeout(() => setShakeFields(false), 350)
      return
    }

    // Monta timestamp UTC a partir da data/hora local selecionada pelo usuário
    const [hh, mm] = horario.split(':').map(Number)
    const localDate = new Date(
      dataSelecionada!.getFullYear(),
      dataSelecionada!.getMonth(),
      dataSelecionada!.getDate(),
      hh, mm, 0
    )
    const scheduledStartTime = localDate.toISOString()

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      // Verificar conflito de horário antes de criar
      const durationMin = DURACAO_MINUTOS[duracao]
      const newStart = localDate.getTime()
      const newEnd = newStart + durationMin * 60 * 1000

      const dayStart = new Date(localDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(localDate)
      dayEnd.setHours(23, 59, 59, 999)

      const userId = user.id

      // Bloqueio live × live: não deixa cadastrar duas lives no mesmo horário.
      // (Videochamadas individuais não entram mais nessa validação — fluxo novo
      // depende de aceite manual do creator.)
      const { data: lives } = await supabase
        .from('live_streams')
        .select('scheduled_start_time, estimated_duration_minutes, title')
        .eq('creator_id', userId)
        .in('status', ['scheduled', 'live'])
        .gte('scheduled_start_time', dayStart.toISOString())
        .lte('scheduled_start_time', dayEnd.toISOString())

      for (const live of lives ?? []) {
        const existStart = new Date(live.scheduled_start_time).getTime()
        const existEnd = existStart + (live.estimated_duration_minutes ?? 60) * 60 * 1000
        if (newStart < existEnd && newEnd > existStart) {
          toast.error(t('events.timeConflictLive'))
          setLoading(false)
          return
        }
      }

      // Create live stream via Stripe Edge Function (creates Product/Price + DB record)
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const res = await fetch(`${base}/functions/v1/create-stripe-live-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: titulo.trim(),
          description: descricao.trim() || null,
          scheduled_start_time: scheduledStartTime,
          ticket_price: valorNum,
          estimated_duration_minutes: DURACAO_MINUTOS[duracao],
        }),
      })

      const resData = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errMsg = resData?.message ?? resData?.error ?? t('events.errorCreating')
        // Hint if Stripe account is not set up
        if (errMsg.includes('stripe') || errMsg.includes('account')) {
          toast.error('Configure sua conta Stripe antes de criar eventos pagos.')
        } else {
          toast.error(errMsg)
        }
        return
      }

      toast.success(t('events.eventCreated'))
      onClose()
      onRefresh()
    } catch (err) {
      console.error('[NovoEventoModal] erro:', err)
      toast.error(t('events.errorCreating'))
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────

  const shakeStyle = shakeFields ? { animation: 'novoEventoShake 300ms ease' } : {}

  return (
    <>
      <style>{modalKeyframes}</style>

      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        className="fixed inset-0 z-[9999] bg-black/[0.65] backdrop-blur-[3px] flex items-center justify-center p-6 [animation:novoEventoOverlayIn_180ms_ease_forwards]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          aria-labelledby="novo-evento-titulo"
          className="bg-[var(--color-surface)] rounded-[20px] max-h-[85vh] overflow-y-auto w-full max-w-[460px] [animation:novoEventoModalIn_220ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
        >
          {/* Header com gradiente sutil */}
          <div className="bg-[linear-gradient(135deg,rgba(174,50,195,0.1)_0%,rgba(101,22,147,0.06)_100%)] rounded-t-[20px] px-6 pt-5 pb-4 flex items-center justify-between">
            <div className="w-8" />
            <h2
              id="novo-evento-titulo"
              className="text-center text-lg font-semibold text-[var(--color-foreground)] m-0"
            >
              {t('events.newEvent')}
            </h2>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="bg-white/[0.06] border-none cursor-pointer text-[var(--color-muted)] p-1.5 rounded-lg flex items-center justify-center transition-colors hover:text-[var(--color-foreground)] hover:bg-white/10"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Campos do formulário */}
          <div className="px-6 pt-5 pb-6 flex flex-col gap-[18px]">

            {/* Título do evento */}
            <div style={shakeStyle}>
              <label htmlFor="novo-evento-titulo-input" className="text-[13px] font-semibold text-[var(--color-foreground)] mb-1.5 block">
                {t('events.eventName')}
              </label>
              <input
                id="novo-evento-titulo-input"
                type="text"
                placeholder={t('events.eventTitlePlaceholder')}
                value={titulo}
                onChange={(e) => { setTitulo(e.target.value); setErroTitulo(false) }}
                onFocus={handleFocus}
                onBlur={(e) => handleBlurStyle(e, erroTitulo)}
                className={sharedInputClass}
                style={{ border: `1px solid ${getInputBorderColor(erroTitulo)}` }}
              />
              {erroTitulo && (
                <span className="text-[var(--color-error)] text-xs mt-1 block">
                  {t('events.fieldRequired')}
                </span>
              )}
            </div>

            {/* Descrição */}
            <div>
              <label htmlFor="novo-evento-descricao" className="text-[13px] font-semibold text-[var(--color-foreground)] mb-1.5 block">
                {t('events.eventDescription')}
              </label>
              <textarea
                id="novo-evento-descricao"
                placeholder={t('events.eventDescriptionPlaceholder')}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(174, 50, 195, 0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                rows={3}
                maxLength={500}
                className={`${sharedInputClass} resize-y min-h-[72px] font-[inherit]`}
                style={{ border: `1px solid var(--color-border)` }}
              />
            </div>

            {/* Duração */}
            <div style={shakeStyle}>
              <label htmlFor="novo-evento-duracao" className="text-[13px] font-semibold text-[var(--color-foreground)] mb-1.5 block">
                {t('events.eventDuration')}
              </label>
              <select
                id="novo-evento-duracao"
                value={duracao}
                onChange={(e) => { setDuracao(e.target.value as DuracaoOption); setErroDuracao(false) }}
                onFocus={handleFocus as unknown as React.FocusEventHandler<HTMLSelectElement>}
                onBlur={(e) => handleBlurStyle(e, erroDuracao)}
                className={`${sharedInputClass} cursor-pointer appearance-none pr-9`}
                style={{
                  border: `1px solid ${getInputBorderColor(erroDuracao)}`,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a9a9a' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                }}
              >
                <option value="1hora">{t('events.duration1hour')}</option>
                <option value="30min">{t('events.duration30min')}</option>
              </select>
              {erroDuracao && (
                <span className="text-[var(--color-error)] text-xs mt-1 block">
                  {t('events.fieldRequired')}
                </span>
              )}
            </div>

            {/* Valor do ingresso */}
            <div style={shakeStyle}>
              <label htmlFor="novo-evento-valor" className="text-[13px] font-semibold text-[var(--color-foreground)] mb-1.5 block">
                {t('events.eventPrice')}
              </label>
              <input
                id="novo-evento-valor"
                type="text"
                inputMode="numeric"
                placeholder={formatZeroCurrency(bcp47)}
                value={valorRaw}
                onChange={handleValorChange}
                onBlur={(e) => { handleValorBlur(); handleBlurStyle(e, erroValor) }}
                onFocus={handleFocus}
                className={sharedInputClass}
                style={{ border: `1px solid ${getInputBorderColor(erroValor)}` }}
              />
              {erroValor && (
                <span className="text-[var(--color-error)] text-xs mt-1 block">
                  {t('register.minValue')}
                </span>
              )}
            </div>

            {/* Dia do Evento + Horário */}
            <div className="flex gap-3" style={shakeStyle}>

              {/* Dia do Evento */}
              <div className="flex-1">
                <label className="text-[13px] font-semibold text-[var(--color-foreground)] mb-1.5 block">{t('events.eventDate')}</label>

                {/* Input nativo oculto */}
                <input
                  ref={dateInputRef}
                  type="date"
                  min={getTodayLocalYYYYMMDD()}
                  onChange={handleDateChange}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  aria-hidden="true"
                  tabIndex={-1}
                />

                <button
                  type="button"
                  onClick={openDatePicker}
                  className="flex items-center gap-2 w-full bg-[var(--color-surface-2)] rounded-[10px] px-3.5 py-[11px] cursor-pointer text-sm transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-primary)] hover:shadow-[0_0_0_3px_rgba(174,50,195,0.15)]"
                  style={{
                    border: `1px solid ${getInputBorderColor(erroData)}`,
                    color: dataSelecionada ? 'var(--color-foreground)' : 'var(--color-muted)', /* dynamic value - cannot be Tailwind */
                  }}
                  aria-label={t('events.selectDate')}
                >
                  <span className="text-[var(--color-muted)] flex shrink-0">
                    <CalendarIcon />
                  </span>
                  <span>{formatDateDisplay(dataSelecionada, t('events.selectDate'))}</span>
                </button>

                {erroData && (
                  <span className="text-[var(--color-error)] text-xs mt-1 block">
                    {t('events.fieldRequired')}
                  </span>
                )}
              </div>

              {/* Horário */}
              <div className="flex-1">
                <label htmlFor="novo-evento-horario" className="text-[13px] font-semibold text-[var(--color-foreground)] mb-1.5 block">
                  {t('events.eventTime')}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] flex pointer-events-none">
                    <ClockIcon />
                  </span>
                  <input
                    id="novo-evento-horario"
                    type="text"
                    inputMode="numeric"
                    placeholder="00:00"
                    value={horario}
                    onChange={handleHorarioChange}
                    onFocus={handleFocus}
                    onBlur={(e) => handleBlurStyle(e, erroHorario)}
                    maxLength={5}
                    className={`${sharedInputClass} pl-10`}
                    style={{ border: `1px solid ${getInputBorderColor(erroHorario)}` }}
                  />
                </div>
                {erroHorario && (
                  <span className="text-[var(--color-error)] text-xs mt-1 block">
                    {t('events.invalidTime')}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-[var(--color-muted)] m-0">
              {t('events.localTimezoneHint')}
            </p>

            {/* Separador */}
            <div className="h-px bg-[var(--color-border)] my-1" />

            {/* Botão Confirmar */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-12 rounded-xl text-white border-none text-[15px] font-semibold flex items-center justify-center gap-2 transition-[opacity,transform] duration-150 active:scale-[0.98]"
              style={{
                background: loading ? 'var(--color-primary-dark)' : 'linear-gradient(135deg, #AE32C3, #651693)', /* dynamic value - cannot be Tailwind */
                cursor: loading ? 'not-allowed' : 'pointer', /* dynamic value - cannot be Tailwind */
                opacity: loading ? 0.7 : 1, /* dynamic value - cannot be Tailwind */
              }}
            >
              {loading && <SpinnerIcon />}
              {loading ? t('events.creating') : t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
