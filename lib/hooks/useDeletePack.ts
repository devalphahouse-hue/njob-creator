'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { deletePack } from '@/lib/api/content'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'

/**
 * Exclusão (soft-delete/arquivamento) de pacote de conteúdo.
 * O pacote é marcado como 'archived' no Supabase: some da lista do creator e
 * da vitrine, mas quem já comprou mantém acesso (garantido por RLS no banco).
 *
 * Invalida a lista `get_packs_by_creator` no sucesso. Passe `onSuccess` para
 * comportamento extra (ex.: navegar de volta na tela de detalhe).
 */
export function useDeletePack(onSuccess?: () => void) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async (packId: string) => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('no-session')
      await deletePack(packId, token)
    },
    onSuccess: () => {
      // Prefixo: invalida todas as variantes (filtros) da lista
      queryClient.invalidateQueries({ queryKey: ['get_packs_by_creator'] })
      toast.success(t('content.contentDeleted'))
      onSuccess?.()
    },
    onError: () => {
      toast.error(t('content.errorDeleting'))
    },
  })
}
