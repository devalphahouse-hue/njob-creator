'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n'
import PageHeader from '@/components/ui/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { formatCep, sanitizeCep, isCompleteCep, resolveCep, type CepError } from '@/lib/utils/cep'

/**
 * Localização do creator — o que o coloca no filtro "creators até X km" do app
 * cliente. Creators cadastrados antes desta feature não têm CEP salvo (o
 * cadastro antigo usava o CEP só para preencher a cidade e o descartava), então
 * esta tela é o caminho para eles entrarem no filtro.
 */
export default function AlterarLocalizacaoPage() {
  const router = useRouter()
  const { t } = useTranslation()

  const [cep, setCep] = useState('')
  const [savedCity, setSavedCity] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [preview, setPreview] = useState<{ cityName: string; uf: string } | null>(null)
  const [resolvedIbge, setResolvedIbge] = useState<number | null>(null)

  // Carrega o que já está salvo para o creator ver seu estado atual.
  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return
      const { data } = await supabase
        .from('profiles')
        .select('cep, city_ibge_code')
        .eq('id', user.id)
        .maybeSingle()
      if (data?.cep) setCep(data.cep)

      // Duas consultas em vez de embed `cities(...)`: o embed depende de o cache
      // de schema do PostgREST já enxergar a FK recém-criada, e essa atualização
      // pode atrasar depois do deploy da migration.
      if (data?.city_ibge_code) {
        const { data: city } = await supabase
          .from('cities')
          .select('name, uf')
          .eq('ibge_code', data.city_ibge_code)
          .maybeSingle()
        if (city) setSavedCity(`${city.name}/${city.uf}`)
      }
    })().catch(() => { /* não crítico: a tela abre vazia */ })
  }, [])

  const errorMessage = (code: CepError) =>
    ({
      invalid_format: t('profile.location.errorFormat'),
      not_found: t('profile.location.errorNotFound'),
      city_unknown: t('profile.location.errorCityUnknown'),
      network: t('profile.location.errorNetwork'),
    })[code]

  const handleCepChange = (value: string) => {
    setCep(sanitizeCep(value))
    // Editar o CEP invalida o município já resolvido — senão dava para trocar o
    // CEP e salvar a cidade antiga.
    setPreview(null)
    setResolvedIbge(null)
    setError(undefined)
  }

  const handleResolve = async () => {
    if (!isCompleteCep(cep) || resolving) return
    setResolving(true)
    setError(undefined)
    const supabase = createClient()
    const result = await resolveCep(supabase, cep)
    setResolving(false)

    if (!result.ok) {
      setError(errorMessage(result.error))
      return
    }
    setPreview({ cityName: result.data.cityName, uf: result.data.uf })
    setResolvedIbge(result.data.ibgeCode)
  }

  const handleConfirm = async () => {
    if (resolvedIbge == null || saving) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('Sem sessão')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cep: sanitizeCep(cep), city_ibge_code: resolvedIbge })
        .eq('id', user.id)
      if (updateError) throw updateError

      toast.success(t('profile.location.success'))
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.location.errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-[var(--color-background)]">
      <PageHeader title={t('profile.location.title')} />

      <div className="flex flex-col gap-5 px-4 pt-6">
        <p className="text-sm text-[var(--color-muted)]">
          {t('profile.location.creatorDescription')}
        </p>

        {savedCity && !preview && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-[var(--color-surface)]">
            <MapPin size={16} className="shrink-0 text-[var(--color-primary)]" />
            <p className="text-sm text-[var(--color-foreground)]">
              {t('profile.location.current', { city: savedCity })}
            </p>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label={t('profile.location.label')}
              placeholder="00000-000"
              inputMode="numeric"
              autoComplete="postal-code"
              value={formatCep(cep)}
              onChange={(e) => handleCepChange(e.target.value)}
              onBlur={handleResolve}
              error={error}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleResolve}
            loading={resolving}
            disabled={!isCompleteCep(cep)}
          >
            {t('profile.location.lookup')}
          </Button>
        </div>

        {preview && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 bg-[var(--color-surface)]">
            <MapPin size={16} className="shrink-0 text-[var(--color-primary)]" />
            <p className="text-sm text-[var(--color-foreground)]">
              {preview.cityName}/{preview.uf}
            </p>
          </div>
        )}

        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          loading={saving}
          disabled={resolvedIbge == null}
          onClick={handleConfirm}
        >
          {t('common.confirm')}
        </Button>
      </div>
    </div>
  )
}
