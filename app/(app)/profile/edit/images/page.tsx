'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAppStore, useCreator } from '@/lib/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import DicasFotosModal from '@/components/ui/DicasFotosModal'
import PhotoSourceSheet from '@/components/ui/PhotoSourceSheet'
import type { ImagesCreator } from '@/lib/types/database'
import { ImagePlus, Trash2, Loader2 } from 'lucide-react'

// ─── Image Slot ───────────────────────────────────────────────────────────────

interface ImageSlotProps {
  url: string | null
  uploading: boolean
  onSelect: () => void
  onRemove?: () => void
  width?: string
  height?: string
}

function ImageSlot({ url, uploading, onSelect, onRemove, width = '80px', height = '80px' }: ImageSlotProps) {
  return (
    <div className="relative" style={{ width, height }}>
      {url ? (
        <>
          <img
            src={url}
            alt="Foto"
            className="w-full h-full object-cover rounded-lg"
          />
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center bg-[var(--color-error)] text-white"
              aria-label="Remover foto"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          )}
        </>
      ) : (
        <button
          onClick={onSelect}
          disabled={uploading}
          className="w-full h-full rounded-lg flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50 bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] text-[var(--color-muted)]"
          aria-label="Adicionar foto"
        >
          {uploading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <ImagePlus size={24} strokeWidth={1.5} />
          )}
        </button>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadImage(file: File, userId: string, path: string): Promise<string> {
  const supabase = createClient()
  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError
  const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
  return publicUrl
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AlterarImagensPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const creator = useCreator()
  const setCreator = useAppStore((s) => s.setCreator)

  const images = creator?.images ?? []

  // Highlight image (capa) = highlight_image_url: true
  const capaImage = images.find((img) => img.highlight_image_url)
  // Complementary images = highlight_image_url: false
  const complementares = images.filter((img) => !img.highlight_image_url)

  const [capaUrl, setCapaUrl] = useState<string | null>(capaImage?.image_url ?? null)
  const [comp1, setComp1] = useState<string | null>(complementares[0]?.image_url ?? null)
  const [comp2, setComp2] = useState<string | null>(complementares[1]?.image_url ?? null)
  const [comp3, setComp3] = useState<string | null>(complementares[2]?.image_url ?? null)

  const [uploadingCapa, setUploadingCapa] = useState(false)
  const [uploadingComp, setUploadingComp] = useState<[boolean, boolean, boolean]>([false, false, false])
  const [loading, setLoading] = useState(false)
  const [dicasModalOpen, setDicasModalOpen] = useState(false)

  // Which slot the photo-source sheet is currently targeting.
  const [photoTarget, setPhotoTarget] = useState<'capa' | 0 | 1 | 2 | null>(null)

  const handleUploadCapa = async (file: File) => {
    if (!file) return
    setUploadingCapa(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sem sessão')
      const ext = file.name.split('.').pop()
      const url = await uploadImage(file, user.id, `profiles/${user.id}/capa.${ext}`)
      setCapaUrl(url)
    } catch {
      toast.error(t('profile.errorUploadCover'))
    } finally {
      setUploadingCapa(false)
    }
  }

  const handleUploadComp = (index: 0 | 1 | 2) => async (file: File) => {
    if (!file) return
    const setters = [setComp1, setComp2, setComp3]
    const setUploadingIndex = (val: boolean) => {
      setUploadingComp((prev) => {
        const next: [boolean, boolean, boolean] = [...prev] as [boolean, boolean, boolean]
        next[index] = val
        return next
      })
    }
    setUploadingIndex(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sem sessão')
      const ext = file.name.split('.').pop()
      const url = await uploadImage(file, user.id, `profiles/${user.id}/comp${index + 1}.${ext}`)
      setters[index](url)
    } catch {
      toast.error(t('profile.errorUploadPhoto'))
    } finally {
      setUploadingIndex(false)
    }
  }

  const handlePickPhoto = (files: File[]) => {
    const file = files[0]
    if (!file || photoTarget === null) return
    if (photoTarget === 'capa') {
      void handleUploadCapa(file)
    } else {
      void handleUploadComp(photoTarget)(file)
    }
  }

  const handleConfirm = async () => {
    if (!creator) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sem sessão')

      // Build images array for both RPC and local state
      const newImages: ImagesCreator[] = []
      const p_images: Array<{ image_url: string; highlight_image_url: boolean; index: number }> = []

      if (capaUrl) {
        newImages.push({ highlight_image_url: true, image_url: capaUrl })
        p_images.push({ image_url: capaUrl, highlight_image_url: true, index: 0 })
      }

      const compUrls = [comp1, comp2, comp3].filter(Boolean) as string[]
      for (let i = 0; i < compUrls.length; i++) {
        newImages.push({ highlight_image_url: false, image_url: compUrls[i] })
        p_images.push({ image_url: compUrls[i], highlight_image_url: false, index: i })
      }

      const { error } = await supabase.rpc('upsert_profile_images', {
        p_images,
        p_profile_id: user.id,
      })
      if (error) throw error

      setCreator({ ...creator, images: newImages })
      toast.success(t('profile.savedSuccess'))
      router.back()
    } catch (err) {
      console.error(err)
      toast.error(t('profile.errorSavePhotos'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-[var(--color-background)]">
      <PageHeader title={t('profile.editPhotos')} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-6">

          <p className="text-sm text-[var(--color-foreground)]">
            {t('profile.editPhotosDesc')}
          </p>

          {/* Fotos complementares */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-[var(--color-foreground)]">
                {t('profile.complementaryPhotos')}
              </p>
              <p className="text-xs mt-0.5 text-[var(--color-muted)]">
                {t('profile.complementaryPhotosDesc')}
              </p>
            </div>

            <div className="flex gap-3">
              <ImageSlot
                url={comp1}
                uploading={uploadingComp[0]}
                onSelect={() => setPhotoTarget(0)}
                onRemove={comp1 ? () => setComp1(null) : undefined}
                width="80px"
                height="80px"
              />
              <ImageSlot
                url={comp2}
                uploading={uploadingComp[1]}
                onSelect={() => setPhotoTarget(1)}
                onRemove={comp2 ? () => setComp2(null) : undefined}
                width="80px"
                height="80px"
              />
              <ImageSlot
                url={comp3}
                uploading={uploadingComp[2]}
                onSelect={() => setPhotoTarget(2)}
                onRemove={comp3 ? () => setComp3(null) : undefined}
                width="80px"
                height="80px"
              />
            </div>
          </div>

          {/* Foto de capa */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-[var(--color-foreground)]">
                {t('register.coverPhoto')}
              </p>
              <p className="text-xs mt-0.5 text-[var(--color-muted)]">
                {t('profile.coverPhotoDesc')}
              </p>
            </div>

            <ImageSlot
              url={capaUrl}
              uploading={uploadingCapa}
              onSelect={() => setPhotoTarget('capa')}
              onRemove={capaUrl ? () => setCapaUrl(null) : undefined}
              width="100%"
              height="120px"
            />
          </div>

          <button
            type="button"
            onClick={() => setDicasModalOpen(true)}
            className="rounded-xl p-3 text-xs w-full text-left bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-primary)]"
          >
            {t('register.photoTipsBtn')}
          </button>
          {dicasModalOpen && <DicasFotosModal onClose={() => setDicasModalOpen(false)} />}

          <PhotoSourceSheet
            open={photoTarget !== null}
            onClose={() => setPhotoTarget(null)}
            onPick={handlePickPhoto}
          />

          <div className="pb-4">
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
