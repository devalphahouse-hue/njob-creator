'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAppStore, useCreator } from '@/lib/store/app-store'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/ui/PageHeader'
import { formatCep } from '@/lib/utils/cep'
import { useTranslation, getLocaleBcp47 } from '@/lib/i18n'
import { ChevronRight, Pencil, User, X } from 'lucide-react'

// ─── Row ─────────────────────────────────────────────────────────────────────

interface InfoRowProps {
  label: string
  value: string | null | undefined
  href?: string
  navigable?: boolean
}

function InfoRow({ label, value, href, navigable = false }: InfoRowProps) {
  const showValue = value != null && value !== ''
  const content = (
    <div className="flex items-center justify-between py-3 min-h-[44px]">
      <span className="text-sm font-medium text-[var(--color-foreground)]">
        {label}
      </span>
      <div className="flex items-center gap-1">
        {showValue && (
          <span className="text-sm truncate max-w-[180px] md:max-w-[240px] text-[var(--color-muted)]">
            {value}
          </span>
        )}
        {navigable && (
          <span className="text-[var(--color-muted)] shrink-0">
            <ChevronRight size={18} strokeWidth={2} />
          </span>
        )}
      </div>
    </div>
  )

  if (href && navigable) {
    return (
      <Link href={href} className="block hover:bg-surface rounded-lg px-1 transition-colors">
        {content}
      </Link>
    )
  }

  return <div className="px-1">{content}</div>
}

function Divider() {
  return <div className="h-px bg-[var(--color-border)]" />
}

// ─── Photo upload modal ───────────────────────────────────────────────────────

interface PhotoModalProps {
  currentUrl: string | null
  onClose: () => void
  onUpload: (file: File) => Promise<void>
  uploading: boolean
  labelTitle: string
  labelTakePhoto: string
  labelChooseFromGallery: string
  labelUploading: string
}

function PhotoModal({ currentUrl, onClose, onUpload, uploading, labelTitle, labelTakePhoto, labelChooseFromGallery, labelUploading }: PhotoModalProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await onUpload(file)
    onClose()
    e.target.value = ''
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-6 pb-10 bg-[var(--color-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-[var(--color-foreground)]">
            {labelTitle}
          </h3>
          <button onClick={onClose} className="text-[var(--color-muted)]">
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {currentUrl && (
          <div className="flex justify-center mb-6">
            <img src={currentUrl} alt="Foto atual" className="w-24 h-24 rounded-full object-cover" />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="block w-full cursor-pointer">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div
              className="w-full py-3 rounded-xl text-center text-sm font-medium transition-opacity hover:opacity-90 bg-[var(--color-primary)] text-white"
            >
              {uploading ? labelUploading : labelTakePhoto}
            </div>
          </label>
          <label className="block w-full cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div
              className="w-full py-3 rounded-xl text-center text-sm font-medium transition-opacity hover:opacity-90 border border-[var(--color-border)] text-[var(--color-foreground)]"
            >
              {uploading ? labelUploading : labelChooseFromGallery}
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined, localeBcp47: string): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(localeBcp47)
  } catch {
    return '-'
  }
}

function getLanguageLabel(code: string): string {
  const map: Record<string, string> = {
    pt: 'Português (Brasil)',
    en: 'English',
    es: 'Español',
  }
  return map[code] ?? code
}

export default function InformacoesPessoaisPage() {
  const creator = useCreator()
  const setCreator = useAppStore((s) => s.setCreator)
  const { t, locale } = useTranslation()
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!cancelled && user?.email) setCurrentUserEmail(user.email)
      })
    return () => { cancelled = true }
  }, [])

  const handleAvatarUpload = async (file: File) => {
    if (!creator) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sem sessão')

      const ext = file.name.split('.').pop()
      const path = `profiles/${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      setCreator({
        ...creator,
        profile: { ...creator.profile, avatar_url: publicUrl },
      })
      toast.success(t('profile.photoUpdated'))
      setPhotoModalOpen(false)
    } catch (err) {
      console.error(err)
      toast.error(t('profile.photoError'))
    } finally {
      setUploading(false)
    }
  }

  if (!creator) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center">
        <p className="text-[var(--color-muted)]">{t('common.loading')}</p>
      </div>
    )
  }

  const { profile, creator_description } = creator

  return (
    <div className="flex flex-col min-h-full bg-[var(--color-background)]">
      <PageHeader title={t('profile.info')} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-6">

          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setPhotoModalOpen(true)}
              className="relative w-20 h-20 rounded-full overflow-hidden transition-opacity hover:opacity-80 bg-[var(--color-surface-2)]"
              aria-label={t('profile.changeProfilePhoto')}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--color-muted)]">
                  <User size={32} strokeWidth={2} />
                </div>
              )}
              <div className="absolute inset-0 flex items-end justify-center pb-1 bg-black/30">
                <Pencil size={16} color="#fff" strokeWidth={2} />
              </div>
            </button>
            <p className="text-xs text-[var(--color-muted)]">
              {t('profile.tapToChangePhoto')}
            </p>
          </div>

          {/* Card: Dados básicos */}
          <div className="rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">{t('profile.basicData')}</p>
            </div>
            <div className="px-4">
              <InfoRow label={t('profile.name')} value={profile.full_name} href="/profile/edit/name" navigable />
              <Divider />
              <InfoRow label={t('profile.language')} value={getLanguageLabel(locale)} href="/profile/edit/language" navigable />
              <Divider />
              <InfoRow
                label={t('profile.location.title')}
                value={profile.cep ? formatCep(profile.cep) : t('profile.location.empty')}
                href="/profile/edit/location"
                navigable
              />
              <Divider />
              <InfoRow label={t('profile.birthDate')} value={formatDate(creator_description?.date_birth, getLocaleBcp47(locale))} />
            </div>
          </div>

          {/* Card: Acesso */}
          <div className="rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">{t('profile.access')}</p>
            </div>
            <div className="px-4">
              <InfoRow label={t('profile.email')} value={currentUserEmail ?? undefined} href="/profile/edit/email" navigable />
              <Divider />
              <InfoRow label={t('profile.password')} value={undefined} href="/profile/edit/password" navigable />
            </div>
          </div>

          {/* Card: Personalização */}
          <div className="rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">{t('profile.customization')}</p>
            </div>
            <div className="px-4">
              <InfoRow label={t('profile.description')} value={undefined} href="/profile/edit/description" navigable />
              <Divider />
              <InfoRow label={t('profile.interactions')} value={undefined} href="/profile/edit/interactions" navigable />
              <Divider />
              <InfoRow label={t('profile.photos')} value={undefined} href="/profile/edit/images" navigable />
            </div>
          </div>

        </div>
      </div>

      {photoModalOpen && (
        <PhotoModal
          currentUrl={profile.avatar_url}
          onClose={() => setPhotoModalOpen(false)}
          onUpload={handleAvatarUpload}
          uploading={uploading}
          labelTitle={t('profile.changeProfilePhoto')}
          labelTakePhoto={t('profile.takePhoto')}
          labelChooseFromGallery={t('profile.chooseFromGallery')}
          labelUploading={t('profile.uploading')}
        />
      )}
    </div>
  )
}
