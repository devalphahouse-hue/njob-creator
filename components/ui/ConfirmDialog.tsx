'use client'

import { useTranslation } from '@/lib/i18n'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Modal de confirmação genérica. Substitui window.confirm.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/[0.72] backdrop-blur-[4px] flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 max-w-[380px] w-full [animation:detalhesModalIn_180ms_cubic-bezier(0.22,1,0.36,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 mb-2 text-lg font-bold text-[var(--color-foreground)]">{title}</h2>
        <p className="m-0 mb-6 text-sm text-[var(--color-muted)] leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-transparent text-sm font-semibold text-[var(--color-foreground)] cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
          >
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'flex-1 px-4 py-2.5 rounded-lg border-none text-sm font-semibold text-white cursor-pointer transition-colors',
              destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--color-primary)]',
            ].join(' ')}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
