'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import PasswordInput from '@/components/ui/PasswordInput'
import PageHeader from '@/components/ui/PageHeader'
import { updatePassword } from '@/lib/supabase/auth'
import { useTranslation } from '@/lib/i18n'

function NewPasswordContent() {
  const router = useRouter()
  const { t } = useTranslation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [newPasswordError, setNewPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setNewPasswordError('')
    setConfirmError('')

    if (!newPassword) {
      setNewPasswordError(t('resetPassword.passwordRequired'))
      return
    }
    if (newPassword.length < 12) {
      setNewPasswordError(t('resetPassword.min6Chars'))
      return
    }
    if (!/[a-z]/.test(newPassword)) {
      setNewPasswordError(t('register.passwordNeedLowercase'))
      return
    }
    if (!/[A-Z]/.test(newPassword)) {
      setNewPasswordError(t('register.passwordNeedUppercase'))
      return
    }
    if (!/[0-9]/.test(newPassword)) {
      setNewPasswordError(t('register.passwordNeedNumber'))
      return
    }
    if (newPassword !== confirmPassword) {
      setConfirmError(t('resetPassword.passwordsMismatch'))
      return
    }

    setLoading(true)

    await updatePassword(newPassword, {
      onSuccess: () => {
        toast.success(t('resetPassword.passwordChanged'))
        router.push('/home')
      },
      onError: (msg) => {
        toast.error(msg)
        setLoading(false)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('resetPassword.newPassword')} />

      <p className="text-sm text-[var(--color-muted)]">
        {t('resetPassword.newPasswordSubtitle')}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordInput
          label={t('resetPassword.newPassword')}
          placeholder="••••••••"
          hint={t('register.passwordRequirements')}
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setNewPasswordError('') }}
          error={newPasswordError}
          autoComplete="new-password"
          required
        />

        <PasswordInput
          label={t('resetPassword.confirmPassword')}
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError('') }}
          error={confirmError}
          autoComplete="new-password"
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!newPassword || !confirmPassword}
          className="mt-2"
        >
          {t('common.confirm')}
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordNewPage() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<div className="text-center py-8 text-[var(--color-muted)]">{t('common.loading')}</div>}>
      <NewPasswordContent />
    </Suspense>
  )
}
