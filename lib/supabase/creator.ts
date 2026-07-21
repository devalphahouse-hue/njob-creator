import { createClient } from '@/lib/supabase/client'
import type { AccountDetails, CreatorData, UserRole } from '@/lib/types/database'

type SupabaseClientType = ReturnType<typeof createClient>

export interface PayoutGateState {
  ready: boolean
  status: 'PENDING' | 'VERIFYING' | 'COMPLETED' | 'REJECTED' | 'MISSING'
  reason: string | null
  pastDue: string[]
  currentlyDue: string[]
  accountDetails: AccountDetails | null
}

/**
 * Verdadeiro estado do Stripe Connect do creator. O backend marca status='COMPLETED'
 * quando details_submitted=true, mas o Stripe pode rejeitar (charges_enabled=false /
 * payouts_enabled=false). Esta é a única função autoritativa para liberar features
 * que tocam Stripe (vender conteúdo, criar live, ligar online, aceitar chamada).
 */
export function isCreatorStripeReady(
  status: string | null | undefined,
  details: AccountDetails | null | undefined,
): boolean {
  if (!status || status !== 'COMPLETED') return false
  if (!details) return false
  return details.charges_enabled === true && details.payouts_enabled === true
}

/**
 * Lê creator_payout_info do usuário autenticado e devolve o estado consolidado
 * para o frontend: ready=true só se Stripe aprovou de fato; reason/pastDue/
 * currentlyDue para mostrar ao usuário o que falta.
 */
export async function fetchPayoutGateState(
  supabase: SupabaseClientType,
  userId: string,
): Promise<PayoutGateState> {
  const { data } = await supabase
    .from('creator_payout_info')
    .select('status, account_details')
    .eq('creator_id', userId)
    .maybeSingle()

  if (!data) {
    return {
      ready: false,
      status: 'MISSING',
      reason: null,
      pastDue: [],
      currentlyDue: [],
      accountDetails: null,
    }
  }

  const details = (data.account_details as AccountDetails | null) ?? null
  const raw = (data.account_details as Record<string, unknown> | null) ?? null
  const reason = (raw?.disabled_reason as string | null | undefined) ?? null
  const pastDue = Array.isArray(raw?.past_due) ? (raw.past_due as string[]) : []
  const currentlyDue = Array.isArray(raw?.currently_due) ? (raw.currently_due as string[]) : []
  const ready = isCreatorStripeReady(data.status, details)

  let normalized: PayoutGateState['status']
  if (ready) normalized = 'COMPLETED'
  else if (data.status === 'COMPLETED' || data.status === 'VERIFYING') {
    // Status diz COMPLETED/VERIFYING mas charges/payouts não estão habilitados:
    // se Stripe disse explicitamente que recusou, marcamos REJECTED; senão VERIFYING.
    normalized = reason ? 'REJECTED' : 'VERIFYING'
  } else {
    normalized = 'PENDING'
  }

  return {
    ready,
    status: normalized,
    reason,
    pastDue,
    currentlyDue,
    accountDetails: details,
  }
}

interface PayoutStatusCallbacks {
  isCreatorAndCompleted: () => void
  isCreatorAndPending: (onboardingUrl: string) => void
  isNotCreator: () => void
  onError: (msg: string) => void
}

/**
 * Checks if the current user is a creator and their Stripe payout status.
 * Replaces Flutter's checkCreatorPayoutStatus custom action.
 */
export async function checkCreatorPayoutStatus(
  supabase: SupabaseClientType,
  callbacks: PayoutStatusCallbacks
): Promise<void> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      callbacks.onError('Usuário não autenticado')
      return
    }

    // Check role in profiles table
    const { data: profileRaw, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const profile = profileRaw as { role: UserRole } | null

    if (profileError || !profile) {
      callbacks.onError('Perfil não encontrado')
      return
    }

    if (profile.role !== 'creator') {
      callbacks.isNotCreator()
      return
    }

    // Check creator_payout_info for Stripe onboarding status
    const { data: payoutInfo, error: payoutError } = await supabase
      .from('creator_payout_info')
      .select('status')
      .eq('creator_id', user.id)
      .maybeSingle()

    if (payoutError) {
      callbacks.onError(payoutError.message)
      return
    }

    if (!payoutInfo) {
      // No payout record — need to create Stripe account
      const result = await createStripeAccount(supabase)
      if ('completed' in result) {
        callbacks.isCreatorAndCompleted()
        return
      }
      if ('verifying' in result) {
        callbacks.isCreatorAndPending('')
        return
      }
      if ('error' in result) {
        callbacks.onError(result.error)
        return
      }
      callbacks.isCreatorAndPending(result.url)
      return
    }

    if (payoutInfo.status === 'COMPLETED') {
      callbacks.isCreatorAndCompleted()
      return
    }

    // Status is VERIFYING — onboarding concluido, Stripe verificando
    if (payoutInfo.status === 'VERIFYING') {
      callbacks.isCreatorAndPending('')
      return
    }

    // Status is PENDING — get onboarding link
    const result = await createStripeAccount(supabase)
    if ('completed' in result) {
      callbacks.isCreatorAndCompleted()
      return
    }
    if ('verifying' in result) {
      callbacks.isCreatorAndPending('')
      return
    }
    if ('error' in result) {
      callbacks.onError(result.error)
      return
    }
    callbacks.isCreatorAndPending(result.url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    callbacks.onError(msg)
  }
}

/**
 * Fetches full creator info. Uses RPC get_profile_info (como no Flutter).
 * Fallback: monta CreatorData a partir das tabelas profiles, creator_description, profile_images.
 */
export async function getCreatorInfo(
  supabase: SupabaseClientType
): Promise<CreatorData | null> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return null

    const profileId = user.id

    // Hydration suplementar: o RPC get_profile_info (legado) não retorna os
    // campos novos is_available_for_calls / last_seen_at. Busca-os direto da
    // tabela profiles em paralelo e mescla depois.
    const profileLivePromise = supabase
      .from('profiles')
      .select('is_available_for_calls, last_seen_at, cep, city_ibge_code')
      .eq('id', profileId)
      .maybeSingle()

    // 1) Tentar RPC get_profile_info (igual ao Flutter)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_profile_info', {
      p_profile_id: profileId,
    })

    if (!rpcError && rpcData != null) {
      const raw = Array.isArray(rpcData) ? rpcData[0] : rpcData
      if (raw && typeof raw === 'object') {
        const base = normalizeCreatorData(raw as Record<string, unknown>)
        const { data: live } = await profileLivePromise
        return mergeCreatorLiveState(base, live)
      }
    }

    // 2) Fallback: buscar das tabelas
    const [profileRes, descRes, imagesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('creator_description').select('*').eq('profile_id', profileId).maybeSingle(),
      supabase.from('profile_images').select('image_url, highlight_image_url').eq('profile_id', profileId),
    ])

    const profileRow = profileRes.data as Record<string, unknown> | null
    if (profileRes.error || !profileRow) return null

    const profile = {
      username: (profileRow.username as string) ?? '',
      full_name: (profileRow.full_name as string) ?? '',
      avatar_url: (profileRow.avatar_url as string) ?? '',
      role: (profileRow.role as CreatorData['profile']['role']) ?? 'creator',
      is_active: profileRow.is_active !== false,
      is_available_for_calls: Boolean(profileRow.is_available_for_calls),
      cep: (profileRow.cep as string | null) ?? null,
      city_ibge_code: (profileRow.city_ibge_code as number | null) ?? null,
      last_seen_at: (profileRow.last_seen_at as string | null) ?? null,
      created_at: (profileRow.created_at as string) ?? '',
      updated_at: (profileRow.updated_at as string) ?? '',
      whatsapp: (profileRow.whatsapp as string) ?? '',
    }

    const descRow = descRes.data as Record<string, unknown> | null
    const creator_description = descRow
      ? {
          idade: (descRow.idade as number) ?? null,
          date_birth: (descRow.date_birth as string) ?? null,
          cidade: (descRow.cidade as string) ?? null,
          eu_sou: (descRow.eu_sou as string) ?? null,
          por: (descRow.por as string) ?? null,
          me_considero: (descRow.me_considero as string) ?? null,
          adoro: (descRow.adoro as string) ?? null,
          pessoas_que: (descRow.pessoas_que as string) ?? null,
          gender: (descRow.gender as string) ?? null,
          created_at: (descRow.created_at as string) ?? '',
          updated_at: (descRow.updated_at as string) ?? '',
        }
      : null

    const imagesRows = (imagesRes.data ?? []) as Array<{ image_url: string; highlight_image_url: boolean }>
    const images = imagesRows.map((row) => ({
      highlight_image_url: Boolean(row.highlight_image_url),
      image_url: row.image_url ?? '',
    }))

    return {
      profile,
      creator_description,
      images,
      plan_name: null,
      has_active_plan: false,
      plan_stripe_id: null,
      account_details: null,
    }
  } catch (err) {
    console.error('getCreatorInfo exception:', err)
    return null
  }
}

function normalizeCreatorData(raw: Record<string, unknown>): CreatorData {
  const profileRaw = (raw.profile ?? raw) as Record<string, unknown>
  return {
    profile: {
      username: (profileRaw.username as string) ?? '',
      full_name: (profileRaw.full_name as string) ?? '',
      avatar_url: (profileRaw.avatar_url as string) ?? '',
      role: (profileRaw.role as CreatorData['profile']['role']) ?? 'creator',
      is_active: profileRaw.is_active !== false,
      is_available_for_calls: Boolean(profileRaw.is_available_for_calls),
      last_seen_at: (profileRaw.last_seen_at as string | null) ?? null,
      created_at: (profileRaw.created_at as string) ?? '',
      updated_at: (profileRaw.updated_at as string) ?? '',
      whatsapp: (profileRaw.whatsapp as string) ?? '',
    },
    creator_description: (raw.creator_description as CreatorData['creator_description']) ?? null,
    images: Array.isArray(raw.images) ? (raw.images as CreatorData['images']) : [],
    plan_name: (raw.plan_name as string) ?? null,
    has_active_plan: Boolean(raw.has_active_plan),
    plan_stripe_id: (raw.plan_stripe_id as string) ?? null,
    account_details: (raw.account_details as CreatorData['account_details']) ?? null,
  }
}

/**
 * Mescla estado "vivo" de profiles (is_available_for_calls, last_seen_at) no
 * CreatorData retornado pelo RPC legado que não os conhece. Se live for null,
 * preserva o que já estava.
 */
function mergeCreatorLiveState(
  base: CreatorData,
  live: {
    is_available_for_calls?: boolean | null
    last_seen_at?: string | null
    cep?: string | null
    city_ibge_code?: number | null
  } | null,
): CreatorData {
  if (!live) return base
  return {
    ...base,
    profile: {
      ...base.profile,
      is_available_for_calls:
        typeof live.is_available_for_calls === 'boolean'
          ? live.is_available_for_calls
          : base.profile.is_available_for_calls,
      last_seen_at:
        live.last_seen_at !== undefined ? live.last_seen_at : base.profile.last_seen_at,
      // get_profile_info é legado e não devolve a localização; vem daqui.
      cep: live.cep !== undefined ? live.cep : base.profile.cep,
      city_ibge_code:
        live.city_ibge_code !== undefined ? live.city_ibge_code : base.profile.city_ibge_code,
    },
  }
}

export async function createStripeAccount(
  supabase: SupabaseClientType
): Promise<{ url: string } | { error: string } | { completed: true } | { verifying: true }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Sessão expirada' }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-connected-account`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    )

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { error: data?.message ?? data?.error ?? `HTTP ${res.status}` }
    }

    // Conta totalmente verificada (charges_enabled = true)
    if (data?.completed === true) {
      return { completed: true }
    }

    // Onboarding concluido mas aguardando verificação do Stripe
    if ('completed' in data && data.completed === false) {
      return { verifying: true }
    }

    const url = data?.url ?? data?.onboarding_url ?? data?.account_link
    if (!url) return { error: 'URL de onboarding não retornada' }

    return { url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao criar conta Stripe' }
  }
}
