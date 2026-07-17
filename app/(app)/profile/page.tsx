'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useCreator, useAppStore } from '@/lib/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { getCreatorInfo } from '@/lib/supabase/creator'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n'
import { User, ChevronRight, Info, Trash2, LogOut, DollarSign, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ─── Menu Item ────────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  href?: string
  onClick?: () => void
  danger?: boolean
  loading?: boolean
}

function MenuItem({ icon, label, href, onClick, danger = false, loading = false }: MenuItemProps) {
  const color = danger ? 'var(--color-error)' : 'var(--color-primary)'
  const textColor = danger ? 'var(--color-error)' : 'var(--color-foreground)'

  const content = (
    <div
      className={[
        'flex items-center gap-3 py-3 px-1 transition-colors cursor-pointer hover:bg-surface rounded-lg min-h-[44px]',
        loading ? 'opacity-60 pointer-events-none' : 'opacity-100 pointer-events-auto',
      ].join(' ')}
    >
      <span style={{ color }}>{icon}</span> {/* dynamic value - cannot be Tailwind */}
      <span className="flex-1 text-sm" style={{ color: textColor }}> {/* dynamic value - cannot be Tailwind */}
        {label}
      </span>
      {loading ? (
        <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />
      ) : !danger ? (
        <span className="text-[var(--color-muted)]">
          <ChevronRight size={18} strokeWidth={2} />
        </span>
      ) : null}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return <div onClick={onClick}>{content}</div>
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="h-px bg-[var(--color-border)]" />
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const creator = useCreator()
  const setCreator = useAppStore((s) => s.setCreator)
  const { t } = useTranslation()

  const [financeiroLoading, setFinanceiroLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Refetch creator data to keep store fresh
  useQuery({
    queryKey: ['creator-profile'],
    queryFn: async () => {
      const supabase = createClient()
      const info = await getCreatorInfo(supabase)
      if (info) setCreator(info)
      return info
    },
    enabled: !!creator,
  })

  const handleFinanceiro = async () => {
    setFinanceiroLoading(true)
    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) {
        toast.error(t('profile.sessionExpired'))
        return
      }
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const res = await fetch(`${base}/functions/v1/creator-payout-update-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const data = await res.json().catch(() => ({}))

      // Conta em verificação pelo Stripe — informar o usuário
      if (data?.status === 'VERIFYING') {
        toast.info(data?.message ?? t('profile.stripeVerifying'))
        return
      }

      if (!res.ok && data?.error !== 'account_onboarding') {
        toast.error(data?.message ?? data?.error ?? `Erro HTTP ${res.status}`)
        return
      }
      const url = data?.url ?? data?.login_url ?? data?.onboarding_url
      if (url) {
        window.open(url, '_blank')
      } else {
        toast.error(t('profile.stripeNoLink'))
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error(t('profile.stripeTimeout'))
      } else {
        toast.error(err instanceof Error ? err.message : t('common.error'))
      }
    } finally {
      setFinanceiroLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.rpc('fn_request_account_deletion')
      if (error) throw error
      setDeleteOpen(false)
      toast.success(t('profile.deleteAccount.success'))
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      // Cooldown de 7 dias após ter reativado a conta por login.
      const cooldown = message.match(/^deletion_cooldown_active:(\d+)/)
      if (cooldown) {
        toast.error(t('profile.deleteAccount.cooldown', { days: Number(cooldown[1]) }))
        return
      }
      toast.error(message || t('profile.deleteAccount.error'))
    } finally {
      setDeleting(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col min-h-full bg-[var(--color-background)]">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-center text-base font-semibold text-[var(--color-foreground)]">
          {t('profile.title')}
        </h1>
      </div>

      {/* Profile summary — toque leva para Informações pessoais */}
      {creator && (
        <Link
          href="/profile/info"
          className="block px-4 py-4 flex items-center gap-4 active:opacity-90 transition-opacity border-b border-[var(--color-border)]"
        >
          <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 bg-[var(--color-surface-2)]">
            {creator.profile.avatar_url ? (
              <img
                src={creator.profile.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--color-muted)]">
                <User size={20} strokeWidth={2} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate text-[var(--color-foreground)]">
              {creator.profile.full_name?.trim() || t('profile.setName')}
            </p>
            <p className="text-sm truncate text-[var(--color-muted)]">
              {creator.profile.username?.trim()
                ? `@${creator.profile.username}`
                : t('profile.setUsername')}
            </p>
          </div>
          <span className="text-[var(--color-muted)] shrink-0">
            <ChevronRight size={18} strokeWidth={2} />
          </span>
        </Link>
      )}

      {/* Menu */}
      <div className="flex-1 px-4 py-2">
        <MenuItem
          icon={<User size={20} strokeWidth={2} />}
          label={t('profile.info')}
          href="/profile/info"
        />
        <Divider />
        <MenuItem
          icon={<DollarSign size={20} strokeWidth={2} />}
          label={financeiroLoading ? t('profile.loadingStripe') : t('nav.financial')}
          onClick={handleFinanceiro}
          loading={financeiroLoading}
        />
        <Divider />
        <MenuItem
          icon={<Info size={20} strokeWidth={2} />}
          label={t('profile.aboutVersion')}
          onClick={() => toast('njob Creator Web — v1.0.0')}
        />
        <Divider />
        <MenuItem
          icon={<Trash2 size={20} strokeWidth={2} />}
          label={t('profile.deleteAccount.menuLabel')}
          onClick={() => setDeleteOpen(true)}
          danger
        />
        <Divider />
        <MenuItem
          icon={<LogOut size={20} strokeWidth={2} />}
          label={t('nav.signOut')}
          onClick={handleLogout}
          danger
        />
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={t('profile.deleteAccount.title')}
        message={t('profile.deleteAccount.body')}
        confirmLabel={t('profile.deleteAccount.confirm')}
        cancelLabel={t('profile.deleteAccount.cancel')}
        destructive
        onConfirm={handleDeleteAccount}
        onCancel={() => { if (!deleting) setDeleteOpen(false) }}
      />
    </div>
  )
}
