/**
 * Content/Packs API — get_packs_by_creator, create_pack_with_items, get_pack_with_items, update_pack_with_items
 */

const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const base = () => process.env.NEXT_PUBLIC_SUPABASE_URL!

export interface PackListItem {
  pack_id: string
  cover_image_url: string
  title: string
  price: number
  photo_count: number
  video_count: number
  updated_at?: string
}

export async function getPacksByCreator(
  creatorId: string,
  token: string,
  filters?: { has_photo?: boolean; has_video?: boolean; start_date?: string; end_date?: string }
): Promise<PackListItem[]> {
  const res = await fetch(`${base()}/rest/v1/rpc/get_packs_by_creator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon(),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_creator_id: creatorId,
      p_has_photo: filters?.has_photo != null ? String(filters.has_photo) : '',
      p_has_video: filters?.has_video != null ? String(filters.has_video) : '',
      p_start_date: filters?.start_date ?? '',
      p_end_date: filters?.end_date ?? '',
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return Array.isArray(data) ? data : (data?.data ?? data?.packs ?? [])
}

export async function createPackWithItems(payload: Record<string, unknown>, token: string): Promise<{ status?: boolean; message?: string; pack_id?: string }> {
  const res = await fetch(`${base()}/rest/v1/rpc/create_pack_with_items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon(),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ p_payload: payload }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(out?.message ?? String(res.status))
  return out
}

export async function getPackWithItems(packId: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${base()}/rest/v1/rpc/get_pack_with_items?p_pack_id=${encodeURIComponent(packId)}`, {
    method: 'GET',
    headers: {
      apikey: anon(),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return (Array.isArray(data) ? data[0] : data) ?? {}
}

/** Edge Function: create product in Stripe + Supabase (mirrors Flutter CriarPacoteNoStripeENoSupabaseCall). */
export async function createStripePack(pPayload: Record<string, unknown>, token: string): Promise<{ status?: boolean; message?: string }> {
  const res = await fetch(`${base()}/functions/v1/create-stripe-pack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ p_payload: pPayload }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(out?.message ?? out?.error ?? String(res.status))
  return out
}

export async function updatePackWithItems(payload: Record<string, unknown>, token: string): Promise<{ status?: boolean; message?: string }> {
  const res = await fetch(`${base()}/rest/v1/rpc/update_pack_with_items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon(),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ p_payload: payload }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(out?.message ?? String(res.status))
  return out
}

/** Soft-delete: marca o pacote como 'archived'. Compradores existentes mantêm acesso. */
export async function deletePack(packId: string, token: string): Promise<void> {
  const res = await fetch(`${base()}/rest/v1/packs?id=eq.${encodeURIComponent(packId)}`, {
    method: 'PATCH',
    headers: {
      apikey: anon(),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'archived' }),
  })
  if (!res.ok) throw new Error(await res.text())
}
