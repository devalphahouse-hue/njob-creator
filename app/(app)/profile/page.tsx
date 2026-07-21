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
import { getErrorMessage, parseDeletionCooldown, daysUntil } from '@/lib/utils/errors'

// ─── Menu Item ────────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  href?: string
  onClick?: () => void
  danger?: boolean
  loading?: boolean
  /** Bloqueia a ação e apaga o item — usado no cooldown de exclusão. */
  disabled?: boolean
  /** Linha de apoio abaixo do label, explicando por que o item está bloqueado. */
  hint?: string
}

function MenuItem({
  icon,
  label,
  href,
  onClick,
  danger = false,
  loading = false,
  disabled = false,
  hint,
}: MenuItemProps) {
  const color = danger ? 'var(--color-error)' : 'var(--color-primary)'
  const textColor = danger ? 'var(--color-error)' : 'var(--color-foreground)'
  const inert = loading || disabled

  const content = (
    <div
      className={[
        'flex items-center gap-3 py-3 px-1 transition-colors rounded-lg min-h-[44px]',
        inert
          ? 'opacity-50 pointer-events-none cursor-default'
          : 'opacity-100 pointer-events-auto cursor-pointer hover:bg-surface',
      ].join(' ')}
      aria-disabled={inert}
    >
      <span style={{ color: disabled ? 'var(--color-muted)' : color }}> {/* dynamic value - cannot be Tailwind */}
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block text-sm"
          style={{ color: disabled ? 'var(--color-muted)' : textColor }} /* dynamic value - cannot be Tailwind */
        >
          {label}
        </span>
        {hint ? (
          <span className="block text-xs mt-0.5 text-[var(--color-muted)]">{hint}</span>
        ) : null}
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

  if (href && !disabled) {
    return <Link href={href}>{content}</Link>
  }

  return <div onClick={inert ? undefined : onClick}>{content}</div>
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

  // Cooldown de exclusão: ao reativar a conta por login, fn_cancel_account_deletion
  // carimba deletion_cooldown_until = now() + 7 dias. Lemos aqui para bloquear o
  // item do menu ANTES de o usuário confirmar — antes, ele só descobria o bloqueio
  // depois de confirmar na modal, e o erro parecia falha do sistema.
  const { data: cooldownUntil } = useQuery({
    queryKey: ['profiles', 'deletion_cooldown_until'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return null
      const { data } = await supabase
        .from('profiles')
        .select('deletion_cooldown_until')
        .eq('id', user.id)
        .maybeSingle()
      return data?.deletion_cooldown_until ?? null
    },
  })

  const cooldownDays = daysUntil(cooldownUntil)

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
      const message = getErrorMessage(err)
      // Cooldown de 7 dias após ter reativado a conta por login. Rede de segurança:
      // o menu já bloqueia esse caso, mas o valor pode ter mudado desde o load.
      const cooldown = parseDeletionCooldown(message)
      if (cooldown !== null) {
        setDeleteOpen(false)
        toast.error(t('profile.deleteAccount.cooldown', { days: cooldown }))
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
          label={
            cooldownDays !== null
              ? t('profile.deleteAccount.cooldownMenuLabel', { days: cooldownDays })
              : t('profile.deleteAccount.menuLabel')
          }
          hint={cooldownDays !== null ? t('profile.deleteAccount.cooldownHint') : undefined}
          onClick={() => setDeleteOpen(true)}
          disabled={cooldownDays !== null}
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
