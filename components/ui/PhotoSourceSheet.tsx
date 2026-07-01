'use client'

import { Camera, Image as ImageIcon, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface PhotoSourceSheetProps {
  /** When true, the bottom-sheet chooser is shown. */
  open: boolean
  onClose: () => void
  /** Called with the picked files (camera always yields one; gallery may yield many when `multiple`). */
  onPick: (files: File[]) => void
  /** Defaults to images only. */
  accept?: string
  /** Allow selecting multiple files from the gallery. Camera always captures a single photo. */
  multiple?: boolean
  /** Hint for which camera to open: 'user' (front, good for selfies/avatars) or 'environment' (rear). */
  capture?: 'user' | 'environment'
}

/**
 * Bottom-sheet that lets the user choose between taking a photo with the camera
 * or picking from the gallery. A plain `<input type="file" accept="image/*">`
 * opens straight into the gallery on many Android devices (no camera option),
 * so we render two inputs: one with `capture` (camera) and one without (gallery).
 * Works on both Android and iOS.
 */
export default function PhotoSourceSheet({
  open,
  onClose,
  onPick,
  accept = 'image/*',
  multiple = false,
  capture = 'environment',
}: PhotoSourceSheetProps) {
  const { t } = useTranslation()

  if (!open) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    onPick(files)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-6 pb-10 bg-[var(--color-surface)] sm:rounded-2xl sm:pb-6 sm:border sm:border-[var(--color-border)] sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-[var(--color-foreground)]">
            {t('common.photoSource.title')}
          </h3>
          <button onClick={onClose} className="text-[var(--color-muted)]" aria-label={t('common.close')}>
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="block w-full cursor-pointer">
            <input
              type="file"
              accept={accept}
              capture={capture}
              className="hidden"
              onChange={handleChange}
            />
            <div className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-opacity hover:opacity-90 bg-[var(--color-primary)] text-white">
              <Camera size={18} />
              {t('common.photoSource.takePhoto')}
            </div>
          </label>

          <label className="block w-full cursor-pointer">
            <input
              type="file"
              accept={accept}
              multiple={multiple}
              className="hidden"
              onChange={handleChange}
            />
            <div className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-opacity hover:opacity-90 border border-[var(--color-border)] text-[var(--color-foreground)]">
              <ImageIcon size={18} />
              {t('common.photoSource.chooseFromGallery')}
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
