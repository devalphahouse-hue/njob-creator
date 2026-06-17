'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { createPackWithItems, createStripePack } from '@/lib/api/content'
import { uploadPackCover, uploadPackItem } from '@/lib/storage/packs'
import { toast } from 'sonner'
import { useTranslation, getLocaleBcp47 } from '@/lib/i18n'
import { useStripeGateState } from '@/components/stripe/StripeGateProvider'
import { useStripeGate } from '@/lib/hooks/useStripeGate'
import PhotoSourceSheet from '@/components/ui/PhotoSourceSheet'

// ─── Currency helpers ──────────────────────────────────────────────

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

function parseCurrencyBRL(raw: string): number {
  const cleaned = raw.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ────────────────────────────────────────────────────────────────────

type PackItem = { url: string; type: 'photo' | 'video' }

export default function ContentCreatePage() {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t: tFn, locale } = useTranslation()
  const bcp47 = getLocaleBcp47(locale)
  const { ready: stripeReady } = useStripeGateState()
  const { ensureReady: ensureStripeReady } = useStripeGate()
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [priceError, setPriceError] = useState(false)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const videoInputRef = useRef<HTMLInputElement>(null)
  // Which image picker the photo-source sheet is targeting.
  const [photoTarget, setPhotoTarget] = useState<'cover' | 'photos' | null>(null)

  const handlePickPhoto = (files: File[]) => {
    if (photoTarget === 'cover') {
      const f = files[0]
      if (f) {
        setCoverFile(f)
        setCoverPreview(URL.createObjectURL(f))
      }
    } else if (photoTarget === 'photos') {
      setPhotoFiles((prev) => [...prev, ...files])
    }
  }
  const onVideosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    setVideoFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }
  const removePhoto = (i: number) => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))
  const removeVideo = (i: number) => setVideoFiles((prev) => prev.filter((_, idx) => idx !== i))

  const submit = async () => {
    // Trava do Stripe: criar conteúdo/pack gera produto no Stripe e venda.
    if (!(await ensureStripeReady())) return
    const titleTrimmed = title.trim()
    const p = parseCurrencyBRL(price)
    if (!titleTrimmed) {
      toast.error(tFn('content.titleRequired'))
      return
    }
    if (p <= 0) {
      setPriceError(true)
      toast.error(tFn('register.minValue'))
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!uid || !token) {
      toast.error(tFn('profile.sessionExpired'))
      return
    }
    setLoading(true)
    try {
      // Gerar pack_id no cliente para upload de arquivos
      const packId = crypto.randomUUID()

      // Upload de arquivos
      let coverImageUrl: string | undefined
      const items: PackItem[] = []
      if (coverFile) {
        coverImageUrl = await uploadPackCover(packId, coverFile)
      }
      let idx = 0
      for (const file of photoFiles) {
        const url = await uploadPackItem(packId, file, 'photo', idx++)
        items.push({ url, type: 'photo' })
      }
      for (const file of videoFiles) {
        const url = await uploadPackItem(packId, file, 'video', idx++)
        items.push({ url, type: 'video' })
      }

      const payload = {
        creator_id: uid,
        title: titleTrimmed,
        price: p,
        currency: 'BRL',
        description: description.trim() || '',
        photo_count: photoFiles.length,
        video_count: videoFiles.length,
        pack_id: packId,
        cover_image_url: coverImageUrl,
        items,
      }
      await createPackWithItems(payload, token)

      // Create Stripe product/price (soft fail — pack stays in DB even if Stripe fails)
      try {
        await createStripePack(payload, token)
      } catch {
        toast.warning('Pack salvo, mas houve um erro ao criar o produto no Stripe. Tente novamente mais tarde.')
      }

      toast.success(tFn('content.contentSaved'))
      // Invalidar cache para a lista atualizar automaticamente
      await queryClient.invalidateQueries({ queryKey: ['get_packs_by_creator'] })
      router.push('/content')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tFn('content.errorSaving'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'block w-full mt-1 px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm'
  const slotCls = 'size-20 rounded-lg bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] flex items-center justify-center cursor-pointer text-[var(--color-muted)] text-xs overflow-hidden'

  return (
    <div className="max-w-[480px] mx-auto">
      <h1 className="text-xl font-semibold mb-4">{tFn('content.create')}</h1>
      <div className="flex flex-col gap-4">
        <label className="text-sm font-semibold">
          {tFn('content.coverImage')}
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPhotoTarget('cover')}
              className={slotCls}
            >
              {coverPreview ? (
                <img src={coverPreview} alt={tFn('content.coverImage')} className="w-full h-full rounded-lg object-cover" />
              ) : (
                <span>+ {tFn('content.coverImage')}</span>
              )}
            </button>
            {coverFile && (
              <span className="text-xs text-[var(--color-muted)]">{coverFile.name}</span>
            )}
          </div>
        </label>

        <label className="text-sm font-semibold">
          {tFn('register.additionalPhotos').split(' ')[0]}
          <div className="mt-1 flex flex-wrap gap-2 items-center">
            <button type="button" onClick={() => setPhotoTarget('photos')} className={slotCls}>
              +
            </button>
            {photoFiles.map((f, i) => (
              <div key={i} className="relative size-20">
                <img
                  src={URL.createObjectURL(f)}
                  alt={f.name}
                  className="w-full h-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={tFn('common.delete')}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-[var(--color-error,#e53e3e)] text-white border-none cursor-pointer text-xs flex items-center justify-center"
                >×</button>
              </div>
            ))}
          </div>
        </label>

        <label className="text-sm font-semibold">
          {tFn('content.uploadMedia')}
          <div className="mt-1 flex flex-wrap gap-2 items-center">
            <input ref={videoInputRef} type="file" accept="video/*" multiple onChange={onVideosChange} className="sr-only" id="videos-upload" />
            <button type="button" onClick={() => videoInputRef.current?.click()} className={slotCls}>
              +
            </button>
            {videoFiles.map((f, i) => (
              <div key={i} className="relative size-20">
                <video
                  src={URL.createObjectURL(f)}
                  className="w-full h-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeVideo(i)}
                  aria-label={tFn('common.delete')}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-[var(--color-error,#e53e3e)] text-white border-none cursor-pointer text-xs flex items-center justify-center"
                >×</button>
              </div>
            ))}
          </div>
        </label>

        <label className="text-sm font-semibold">
          {tFn('content.contentTitle')}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="text-sm font-semibold">
          {tFn('content.contentDescription')} ({tFn('common.optional')})
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
        </label>

        <label className="text-sm font-semibold">
          {tFn('content.price')} (R$)
          <input
            type="text"
            inputMode="numeric"
            value={price}
            onChange={(e) => { setPrice(formatCurrencyBRL(e.target.value, bcp47)); setPriceError(false) }}
            onBlur={() => { if (price && parseCurrencyBRL(price) <= 0) setPriceError(true) }}
            placeholder={new Intl.NumberFormat(bcp47, { style: 'currency', currency: 'BRL' }).format(0)}
            className={[inputCls, priceError ? 'border-[var(--color-error)]' : ''].join(' ')}
          />
          {priceError && (
            <span className="text-[var(--color-error)] text-xs mt-1 block">
              {tFn('register.minValue')}
            </span>
          )}
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] bg-transparent cursor-pointer text-sm"
          >
            {tFn('common.back')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !stripeReady}
            className={[
              'px-5 py-2.5 rounded-lg border-none bg-[var(--color-primary)] text-white font-semibold text-sm',
              loading || !stripeReady ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            ].join(' ')}
          >
            {loading ? tFn('events.creating') : tFn('content.publish')}
          </button>
        </div>
        {!stripeReady && (
          <p className="text-xs text-[var(--color-muted)] -mt-1">
            {tFn('content.stripeLockedHint')}
          </p>
        )}
      </div>

      <PhotoSourceSheet
        open={photoTarget !== null}
        onClose={() => setPhotoTarget(null)}
        onPick={handlePickPhoto}
        multiple={photoTarget === 'photos'}
      />
    </div>
  )
}
