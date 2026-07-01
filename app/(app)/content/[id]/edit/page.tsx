'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPackWithItems } from '@/lib/api/content'
import PackVideoPlayer from '@/components/content/PackVideoPlayer'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useDeletePack } from '@/lib/hooks/useDeletePack'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useTranslation, getLocaleBcp47 } from '@/lib/i18n'

type PackItem = { url: string; type: 'photo' | 'video' }

function normItem(it: { file_url?: string; url?: string; item_type?: string; type?: string }): PackItem {
  const url = (it.file_url ?? it.url) ?? ''
  const type = ((it.item_type ?? it.type) ?? 'photo') as 'photo' | 'video'
  return { url, type: type === 'video' ? 'video' : 'photo' }
}

export default function ContentViewPage() {
  const params = useParams()
  const id = params?.id as string
  const supabase = createClient()
  const router = useRouter()
  const { t, locale } = useTranslation()
  const bcp47 = getLocaleBcp47(locale)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priceDisplay, setPriceDisplay] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [existingItems, setExistingItems] = useState<PackItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useDeletePack(() => router.push('/content'))

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) {
        setFetching(false)
        return
      }
      try {
        const pack = await getPackWithItems(id, token)
        setTitle((pack.title as string) ?? '')
        setDescription((pack.description as string) ?? '')
        setPriceDisplay(
          new Intl.NumberFormat(bcp47, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            .format(pack.price != null ? Number(pack.price) : 0)
        )
        setCoverImageUrl((pack.cover_image_url as string) ?? null)
        const rawItems = (pack.items ?? pack.pack_items) as unknown[]
        setExistingItems(Array.isArray(rawItems) ? rawItems.map((it) => normItem(it as Parameters<typeof normItem>[0])) : [])
      } catch {
        toast.error(t('content.noContent'))
        router.push('/content')
      } finally {
        setFetching(false)
      }
    })()
  }, [id, supabase, router])

  if (!id) return null
  if (fetching) return <div className="p-8 text-center">{t('common.loading')}</div>

  const slotCls = 'size-20 rounded-lg object-cover bg-[var(--color-surface-2)] border border-[var(--color-border)]'

  return (
    <div className="max-w-[480px] mx-auto">
      <h1 className="text-xl font-semibold mb-4">{title}</h1>
      <div className="flex flex-col gap-4">

        {/* Capa */}
        {coverImageUrl && (
          <div>
            <p className="text-sm font-semibold m-0 mb-1">{t('content.coverImage')}</p>
            <div className="w-[120px] h-[120px] rounded-lg overflow-hidden">
              <img src={coverImageUrl} alt={t('content.coverImage')} className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {/* Midias */}
        {existingItems.length > 0 && (
          <div>
            <p className="text-sm font-semibold m-0 mb-1">{t('content.uploadMedia')}</p>
            <div className="flex flex-wrap gap-2">
              {existingItems.map((it, i) => (
                <div key={`item-${i}`}>
                  {it.type === 'photo' ? (
                    <img src={it.url} alt="" className={slotCls} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setVideoModalUrl(it.url)}
                      className="size-20 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-[10px] text-[var(--color-muted)] cursor-pointer"
                    >
                      ▶ Video
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Titulo */}
        <div>
          <p className="text-sm font-semibold m-0 mb-1">{t('content.contentTitle')}</p>
          <p className="text-sm m-0">{title}</p>
        </div>

        {/* Descricao */}
        {description && (
          <div>
            <p className="text-sm font-semibold m-0 mb-1">{t('content.contentDescription')}</p>
            <p className="text-sm m-0 text-[var(--color-muted)]">{description}</p>
          </div>
        )}

        {/* Preco */}
        <div>
          <p className="text-sm font-semibold m-0 mb-1">{t('content.price')}</p>
          <p className="text-sm m-0 text-[var(--color-muted)]">R$ {priceDisplay}</p>
        </div>

        {/* Acoes: voltar + excluir */}
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] bg-transparent cursor-pointer text-sm"
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
            className="px-5 py-2.5 rounded-lg border-none bg-red-500 hover:bg-red-600 text-white cursor-pointer text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={16} strokeWidth={2} />
            {deleteMutation.isPending ? t('content.deleting') : t('content.deleteContent')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        destructive
        title={t('content.deleteContent')}
        message={`${t('content.deleteConfirm')} ${t('content.deleteKeepsAccess')}`}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          setConfirmDelete(false)
          deleteMutation.mutate(id)
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {videoModalUrl && <PackVideoPlayer src={videoModalUrl} onClose={() => setVideoModalUrl(null)} />}
    </div>
  )
}
