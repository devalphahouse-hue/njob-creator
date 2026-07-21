import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolução de CEP para município (base do filtro por distância do app cliente).
 *
 * Caminho principal: o ViaCEP devolve o código IBGE do município direto no campo
 * `ibge`, então NÃO dependemos de casar nome de cidade (que teria problema de
 * acento, caixa e homônimos — há dezenas de "Santa Luzia" no país).
 *
 * `fn_resolve_city` fica como fallback para o caso raro de o código do ViaCEP não
 * existir na tabela `cities` (município criado/fundido depois do seed).
 *
 * Gêmeo de njob-client-web-main/src/lib/cep.ts — os dois apps não compartilham
 * pacote, então mantenha os dois em sincronia ao alterar.
 */

export interface ResolvedCep {
  /** 8 dígitos, sem máscara — é assim que vai para o banco. */
  cep: string
  cityName: string
  uf: string
  ibgeCode: number
}

export type CepError = 'invalid_format' | 'not_found' | 'city_unknown' | 'network'

export function sanitizeCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

/** 12345-678 para exibição. */
export function formatCep(value: string): string {
  const digits = sanitizeCep(value)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function isCompleteCep(value: string): boolean {
  return sanitizeCep(value).length === 8
}

interface ViaCepResponse {
  erro?: boolean | string
  localidade?: string
  uf?: string
  ibge?: string
}

export async function resolveCep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  raw: string,
): Promise<{ ok: true; data: ResolvedCep } | { ok: false; error: CepError }> {
  const cep = sanitizeCep(raw)
  if (cep.length !== 8) return { ok: false, error: 'invalid_format' }

  let payload: ViaCepResponse
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    if (!res.ok) return { ok: false, error: 'network' }
    payload = (await res.json()) as ViaCepResponse
  } catch {
    return { ok: false, error: 'network' }
  }

  // ViaCEP responde 200 com { erro: "true" } para CEP inexistente.
  if (payload.erro || !payload.localidade || !payload.uf) {
    return { ok: false, error: 'not_found' }
  }

  const cityName = payload.localidade
  const uf = payload.uf

  // 1) Código IBGE direto do ViaCEP, conferido contra a nossa tabela.
  const fromViaCep = Number(payload.ibge)
  if (Number.isFinite(fromViaCep) && fromViaCep > 0) {
    const { data } = await supabase
      .from('cities')
      .select('ibge_code')
      .eq('ibge_code', fromViaCep)
      .maybeSingle()
    if (data?.ibge_code) {
      return { ok: true, data: { cep, cityName, uf, ibgeCode: data.ibge_code } }
    }
  }

  // 2) Fallback por nome + UF.
  const { data: resolved } = await supabase.rpc('fn_resolve_city', {
    p_name: cityName,
    p_uf: uf,
  })
  if (typeof resolved === 'number') {
    return { ok: true, data: { cep, cityName, uf, ibgeCode: resolved } }
  }

  return { ok: false, error: 'city_unknown' }
}
