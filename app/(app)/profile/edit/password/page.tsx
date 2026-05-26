'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n'
import PageHeader from '@/components/ui/PageHeader'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'

/**
 * Password validation rule: at least 8 chars, with at least one letter and one number.
 * Mirrors the Flutter custom function validaSenha().
 */
function validarSenha(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)
}

export default function AlterarSenhaPage() {
  const router = useRouter()
  const { t } = useTranslation()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorNew, setErrorNew] = useState<string | undefined>()
  const [errorConfirm, setErrorConfirm] = useState<string | undefined>()

  const isDisabled = !newPassword || !confirmPassword

  const handleConfirm = async () => {
    if (isDisabled) return

    setErrorNew(undefined)
    setErrorConfirm(undefined)

    if (!validarSenha(newPassword)) {
      setErrorNew(t('profile.passwordMin8Chars'))
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorConfirm(t('resetPassword.passwordsMismatch'))
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      toast.success(t('profile.passwordSaved'))
      router.back()
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : t('profile.errorEditPassword')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-[var(--color-background)]">
      <PageHeader title={t('profile.editPassword')} />

      <div className="flex-1 flex flex-col px-4 py-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <PasswordInput
              label={t('profile.newPasswordLabel')}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setErrorNew(undefined)
              }}
              placeholder={t('profile.newPasswordLabel')}
              error={errorNew}
              required
              autoFocus
            />
            {!errorNew && (
              <p className="text-xs italic text-[var(--color-muted)]">
                {t('profile.passwordHint')}
              </p>
            )}
          </div>

          <PasswordInput
            label={t('profile.confirmNewPassword')}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setErrorConfirm(undefined)
            }}
            placeholder={t('profile.confirmNewPassword')}
            error={errorConfirm}
            required
          />
        </div>

        <div className="flex-1" />

        <div className="pb-4">
          <Button
            fullWidth
            loading={loading}
            disabled={isDisabled}
            onClick={handleConfirm}
          >
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
