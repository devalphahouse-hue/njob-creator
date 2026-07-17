'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAppStore, useCreator } from '@/lib/store/app-store'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useTranslation, getLocaleBcp47 } from '@/lib/i18n'
import { MIN_PRICE_BRL } from '@/lib/constants/pricing'
import { useStripeGate } from '@/lib/hooks/useStripeGate'

// ─── Toggle ──────────────────────────────────────────────────────────────────

interface ToggleOptionProps {
  title: string
  value: boolean
  onChange: (value: boolean) => void
}

function ToggleOption({ title, value, onChange }: ToggleOptionProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-[var(--color-foreground)]">
        {title}
      </span>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={[
          'relative w-12 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          value ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200',
            value ? 'translate-x-6' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

// ─── Phone mask ──────────────────────────────────────────────────────────────

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

// ─── Currency input ───────────────────────────────────────────────────────────

function formatCurrency(value: string, localeBcp47 = 'pt-BR'): string {
  const num = value.replace(/\D/g, '')
  if (!num) return ''
  const parsed = parseInt(num, 10) / 100
  return parsed.toLocaleString(localeBcp47, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

interface CurrencyInputProps {
  label: string
  value: string
  onChange: (raw: string) => void
  error?: string
  localeBcp47?: string
}

function CurrencyInput({ label, value, onChange, error, localeBcp47 = 'pt-BR' }: CurrencyInputProps) {
  return (
    <Input
      label={label}
      value={value ? `R$ ${value}` : ''}
      onChange={(e) => {
        const raw = e.target.value.replace(/^R\$\s?/, '')
        onChange(formatCurrency(raw, localeBcp47))
      }}
      placeholder="R$ 0,00"
      error={error}
      inputMode="numeric"
    />
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  children: React.ReactNode
}

function SectionCard({ children }: SectionCardProps) {
  return (
    <div className="rounded-xl p-4 space-y-3 bg-[var(--color-surface)] border border-[var(--color-border)]">
      {children}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AlterarInteracoesPage() {
  const router = useRouter()
  const creator = useCreator()
  const setCreator = useAppStore((s) => s.setCreator)
  const { ensureReady: ensureStripeReady } = useStripeGate()
  const { t, locale } = useTranslation()
  const localeBcp47 = getLocaleBcp47(locale)

  const [vendePacks, setVendePacks] = useState(false)
  const [fazVideochamada, setFazVideochamada] = useState(false)
  const [valor30min, setValor30min] = useState('')
  const [valor1hora, setValor1hora] = useState('')
  const [fazEncontro, setFazEncontro] = useState(false)
  const [whatsapp, setWhatsapp] = useState(formatPhone(creator?.profile.whatsapp ?? ''))
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [errors, setErrors] = useState<{ valor30min?: string; valor1hora?: string }>({})

  useEffect(() => {
    async function loadSettings() {
      if (!creator) {
        setInitialLoading(false)
        return
      }
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setInitialLoading(false)
          return
        }

        const { data } = await supabase
          .from('profile_settings')
          .select('*')
          .eq('profile_id', user.id)
          .single()

        if (data) {
          setVendePacks(data.sell_packs)
          setFazVideochamada(data.sell_calls)
          setFazEncontro(data.face_to_face_meeting)
          if (data.call_per_30_min) {
            setValor30min(formatCurrency(String(Math.round(data.call_per_30_min * 100)), localeBcp47))
          }
          if (data.call_per_1_hr) {
            setValor1hora(formatCurrency(String(Math.round(data.call_per_1_hr * 100)), localeBcp47))
          }
        }
      } catch {
        // Settings may not exist yet — silent failure, user can fill in
      } finally {
        setInitialLoading(false)
      }
    }

    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirm = async () => {
    if (!creator) return

    // Habilitar venda (packs ou videochamada) exige Stripe ready. Sem isso
    // o creator aparece como vendendo mas o checkout falha.
    if ((vendePacks || fazVideochamada) && !(await ensureStripeReady())) return

    if (fazVideochamada) {
      const v30 = parseCurrency(valor30min)
      const v1h = parseCurrency(valor1hora)
      const newErrors: { valor30min?: string; valor1hora?: string } = {}
      if (v30 < MIN_PRICE_BRL) newErrors.valor30min = t('register.minValue')
      if (v1h < MIN_PRICE_BRL) newErrors.valor1hora = t('register.minValue')
      setErrors(newErrors)
      if (Object.keys(newErrors).length > 0) return
    } else {
      setErrors({})
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sem sessao')

      // Upsert profile_settings (cria se não existir, atualiza se já existir)
      const { error: settingsError } = await supabase
        .from('profile_settings')
        .upsert({
          profile_id: user.id,
          sell_packs: vendePacks,
          sell_calls: fazVideochamada,
          face_to_face_meeting: fazEncontro,
          call_per_30_min: parseCurrency(valor30min),
          call_per_1_hr: parseCurrency(valor1hora),
        }, { onConflict: 'profile_id' })

      if (settingsError) throw settingsError

      // Update whatsapp in profiles
      // Normalizar para apenas dígitos antes de comparar e salvar
      const whatsappDigits = whatsapp.replace(/\D/g, '')
      const storedDigits = (creator.profile.whatsapp ?? '').replace(/\D/g, '')

      if (whatsappDigits !== storedDigits) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ whatsapp: whatsappDigits || null })
          .eq('id', user.id)

        if (profileError) throw profileError

        setCreator({
          ...creator,
          profile: { ...creator.profile, whatsapp: whatsappDigits || '' },
        })
      }

      toast.success(t('profile.interactionsSaved'))
      router.back()
    } catch (err) {
      console.error(err)
      toast.error(t('profile.interactionsError'))
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex flex-col min-h-full bg-[var(--color-background)]">
        <PageHeader title={t('profile.editInteractions')} />
        <div className="flex-1 flex items-center justify-center">
          <svg className="animate-spin w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-[var(--color-background)]">
      <PageHeader title={t('profile.editInteractions')} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-4">

          {/* Vende conteudo */}
          <SectionCard>
            <ToggleOption
              title={t('register.sellsContent')}
              value={vendePacks}
              onChange={setVendePacks}
            />
          </SectionCard>

          {/* Videochamada */}
          <SectionCard>
            <ToggleOption
              title={t('register.doesVideoCall')}
              value={fazVideochamada}
              onChange={setFazVideochamada}
            />
            {fazVideochamada && (
              <>
                <div className="h-px bg-[var(--color-border)]" />
                <CurrencyInput
                  label={t('profile.videocallPer30min')}
                  value={valor30min}
                  onChange={setValor30min}
                  error={errors.valor30min}
                  localeBcp47={localeBcp47}
                />
                <CurrencyInput
                  label={t('profile.videocallPer1h')}
                  value={valor1hora}
                  onChange={setValor1hora}
                  error={errors.valor1hora}
                  localeBcp47={localeBcp47}
                />
              </>
            )}
          </SectionCard>

          {/* Encontro presencial */}
          <SectionCard>
            <ToggleOption
              title={t('register.doesMeeting')}
              value={fazEncontro}
              onChange={setFazEncontro}
            />
            <div className="h-px bg-[var(--color-border)]" />
            <Input
              label="WhatsApp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
              placeholder="(11) 9 9999-9999"
              inputMode="numeric"
              maxLength={16}
            />
          </SectionCard>

          <div className="pb-4 pt-2">
            <Button
              fullWidth
              loading={loading}
              onClick={handleConfirm}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
