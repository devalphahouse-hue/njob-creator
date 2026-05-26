# REVISAO URGENTE - Live, Videochamada e Conteudo

> Data: 2026-02-22
> Objetivo: Levantar tudo que precisa ser ajustado para entregar hoje

---

## SERVICOS UTILIZADOS
- **Pagamentos**: Stripe (Edge Functions no Supabase)
- **Live e Videochamada**: ZegoCloud (servico escolhido)
  - Estado atual no web: NAO integrado diretamente. Usa URL externa `live-canvas-vue.lovable.app`
  - O app Flutter original ja usa ZegoCloud SDK
  - Precisa avaliar se integra SDK `@zegocloud/zego-uikit-prebuilt` ou mantém URL externa

---

## REGRAS DE NEGOCIO CRITICAS

### Como funciona cada feature:

**LIVE (Evento - criado pelo Creator):**
- Creator CRIA o evento com data, hora, duracao (30min/1h) e preco (min R$10)
- Varios clientes podem comprar ingresso para o mesmo evento (SEM limite)
- Creator NAO pode criar 2 lives no mesmo dia+horario (considerando duracao)
- Creator NAO pode criar live em dia+horario que ja tem videochamada comprada por cliente

**VIDEOCHAMADA (One-on-One - comprada pelo Cliente):**
- Creator NAO cria videochamada - ele configura sua DISPONIBILIDADE (ex: dia 22, manha: 7h-12h)
- Creator cadastra preco de 30min e 1h na tela inicial (min R$10, ja implementado)
- Creator tambem pode editar preco na tela de perfil
- Cliente vai na tela de detalhes do creator, ve horarios disponiveis e COMPRA um slot
- Cada slot aceita APENAS 1 cliente - comprou, travou aquele dia+horario pra todo mundo
- NAO pode comprar videochamada em horario que ja tem live criada naquele dia+horario

### Tabela de conflitos cruzados:

| Cenario | Resultado | Implementada? |
|---------|-----------|---------------|
| **Live vs Live** (mesmo dia+horario) | BLOQUEADO - creator nao pode criar | NAO |
| **Live vs Call comprada** (mesmo dia+horario) | BLOQUEADO - creator nao pode criar live | NAO |
| **Call vs Live** (mesmo dia+horario) | BLOQUEADO - cliente nao pode comprar call | NAO |
| **Call vs Call** (mesmo dia+horario) | BLOQUEADO - apenas 1 cliente por slot | NAO |
| **Duracao** (30min ou 1h) | Bloqueia slot inteiro (ex: 15h com 1h = 15h-16h ocupado) | NAO |
| **Live sem limite de clientes** | OK - varios podem comprar | OK (sem trava) |
| **Preco videochamada** | Creator configura na tela inicial e perfil | OK (ja implementado) |

> **ATENCAO**: Nenhuma validacao de conflito esta implementada. O `NovoEventoModal` cria lives sem verificar conflitos e nao ha trava de compra de videochamada.

---

## RESUMO RAPIDO

| Feature | Estado Geral | Funciona? | O que falta? |
|---------|-------------|-----------|--------------|
| **Live** | ~80% | SIM (fluxo basico) | Validacao de conflito de horario, cancelar live |
| **Videochamada** | ~40% | PARCIAL | Trava de 1 cliente, conflito horario, fluxo aceitar/rejeitar |
| **Conteudo** | ~70% | SIM (criar/listar/deletar) | Edicao de pacotes nao funciona |

---

## 1. LIVE STREAMING

### O que JA funciona:
- [x] Criar evento de live (modal com titulo, duracao, preco, data, hora)
- [x] Integracao com Stripe (cria Product + Price via Edge Function `create-stripe-live-ticket`)
- [x] Listar eventos na Home (proximos 3 do dia)
- [x] Listar eventos na Agenda/Schedule (calendario completo)
- [x] Card de evento com status (upcoming/available/finished)
- [x] Botao "Entrar na live" aparece 15 min antes do horario
- [x] Abre sala externa (live-canvas-vue.lovable.app) como host
- [x] Verificacao de permissao camera/audio antes de abrir
- [x] i18n completo (pt/en/es)

### O que PRECISA ser feito:

#### PRIORIDADE 1 - Critico para funcionar hoje
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| L1 | Validacao de conflito de horario | Ao criar live, verificar se ja existe evento (live ou call) no mesmo horario. Considerar duracao (30min/1h) para calcular sobreposicao. Query em `vw_creator_events` antes de chamar Edge Function | MEDIA |
| L2 | Cancelar/deletar evento | Creator nao consegue cancelar uma live agendada. Precisa de botao no DetalhesAgendamentoModal ou no card | MEDIA |
| L3 | Status automatico | Evento nao muda automaticamente de `scheduled` para `live` quando chega a hora, nem para `finished` quando acaba. Precisa de logica no frontend ou trigger no DB | MEDIA |

#### PRIORIDADE 2 - Importante mas pode esperar
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| L3 | Ver vendas de ingressos | Creator nao ve quantos ingressos foram vendidos para cada live | MEDIA |
| L4 | Upload de capa/thumbnail | Campo `cover_image_url` existe no DB mas nao tem upload na UI | BAIXA |
| L5 | Descricao detalhada | Hoje o campo description so guarda duracao. Permitir descricao real | BAIXA |

#### PRIORIDADE 3 - Nice to have
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| L6 | Notificacoes de compra | Notificar creator quando alguem compra ingresso | ALTA |
| L7 | Chat durante live | Chat ao vivo integrado (usaria Supabase Realtime) | ALTA |
| L8 | Gravacao/VOD | Salvar live para assistir depois | ALTA |

---

## 2. VIDEOCHAMADA (One-on-One Call)

### Fluxo correto:
1. Creator configura DISPONIBILIDADE (dias + horarios) na pagina de disponibilidade
2. Cliente ve horarios disponiveis na tela de detalhes do creator
3. Cliente COMPRA um slot especifico (ex: dia 22 as 15h)
4. Slot fica bloqueado para qualquer outra compra
5. Creator e cliente entram na videochamada no horario marcado

### O que JA funciona:
- [x] Tabela `one_on_one_calls` no banco (schema completo)
- [x] Configuracao de precos (30min e 1h) na pagina de Interacoes
- [x] Toggle para ativar/desativar videochamada no perfil
- [x] Pagina de configuracao de disponibilidade (`/schedule/availability`)
- [x] Visualizacao de calls agendadas na Home e Agenda (via `vw_creator_events`)
- [x] Botao "Entrar na videochamada" que abre live-canvas-vue/ZegoCloud
- [x] Verificacao de permissao camera/audio
- [x] Enum de status: requested, confirmed, completed, cancelled_by_user, cancelled_by_creator, rejected
- [x] i18n completo (pt/en/es)

### O que PRECISA ser feito:

#### PRIORIDADE 1 - Critico para funcionar hoje
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| V1 | Trava de 1 cliente por slot | Quando cliente compra um horario, ninguem mais pode comprar (nem ele mesmo). Validacao no backend (Edge Function / RLS / constraint) | ALTA |
| V2 | Conflito call vs live | Se tem call comprada num horario, creator NAO pode criar live nesse slot. E vice-versa: se tem live, cliente NAO pode comprar call | MEDIA |
| V3 | Visualizacao de calls agendadas | Creator precisa ver chamadas que clientes compraram, com detalhes (cliente, horario, status) | ALTA |
| V4 | Cancelar chamada | Creator e cliente podem cancelar chamada agendada | MEDIA |

#### PRIORIDADE 2 - Importante mas pode esperar
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| V5 | Edge Function para compra de call | Backend para cliente comprar slot de videochamada (validar disponibilidade + trava + Stripe) | ALTA |
| V6 | Historico de chamadas | Lista de chamadas passadas (completed/cancelled) | MEDIA |
| V7 | Notificacao de nova compra | Alerta ao creator quando cliente compra um horario | MEDIA |

#### PRIORIDADE 3 - Nice to have
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| V8 | Timer durante chamada | Contador de tempo (30min/1h) durante a call | MEDIA |
| V9 | Rating pos-chamada | Sistema de avaliacao apos a call | MEDIA |
| V10 | Integrar ZegoCloud SDK | Integrar SDK nativo em vez de URL externa | ALTA |

---

## 3. CONTEUDO (Packs)

### O que JA funciona:
- [x] Criar pacote: upload de capa + fotos + videos + titulo + descricao + preco
- [x] Integracao com Stripe (Edge Function `create-stripe-pack`)
- [x] Upload para Supabase Storage (bucket `images`, path `packs/{id}/...`)
- [x] Listar pacotes com filtros (por foto, video, periodo)
- [x] Visualizar detalhes do pacote (capa, galeria, video player)
- [x] Deletar pacote (soft-delete, status = 'archived')
- [x] Video player em modal fullscreen
- [x] Validacao de preco minimo (R$10)
- [x] React Query com cache e invalidacao
- [x] i18n completo (pt/en/es)

### O que PRECISA ser feito:

#### PRIORIDADE 1 - Critico para funcionar hoje
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| C1 | Editar pacote | A pagina `/content/[id]/edit` e APENAS visualizacao (read-only). A RPC `update_pack_with_items` existe no Supabase mas NAO esta conectada na UI. Creator nao consegue editar titulo, preco, descricao ou midias de um pacote ja criado | ALTA |

#### PRIORIDADE 2 - Importante mas pode esperar
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| C2 | Validacao de tipo de arquivo | Aceita qualquer arquivo no upload. Precisa validar MIME type (image/*, video/*) | BAIXA |
| C3 | Limite de tamanho de arquivo | Sem limite de tamanho no upload. Definir max (ex: 50MB foto, 500MB video) | BAIXA |
| C4 | Limite de quantidade | Sem limite de quantos arquivos podem ser enviados por pacote | BAIXA |
| C5 | Ver vendas de pacotes | Creator nao ve quantos pacotes foram vendidos / faturamento por pacote | MEDIA |

#### PRIORIDADE 3 - Nice to have
| # | Item | Descricao | Complexidade |
|---|------|-----------|-------------|
| C6 | Compressao de imagem | Otimizar imagens antes do upload (reduzir tamanho) | MEDIA |
| C7 | Thumbnails de video | Gerar thumbnail automatico para videos | ALTA |
| C8 | Preview antes de publicar | Mostrar como o pacote vai aparecer para o cliente | MEDIA |

---

## PLANO DE ACAO - O QUE FAZER HOJE

### Ordem sugerida (por impacto + viabilidade):

#### Bloco 1 - Validacao de conflito de horario (CRITICO)
1. **Live: verificar conflito ao criar** - No `NovoEventoModal`, antes de chamar Edge Function, consultar `vw_creator_events` + `one_on_one_calls` para verificar se ja existe evento ou call naquele slot. Considerar duracao (30min/1h) para detectar sobreposicao. Mostrar erro claro.
2. **Call: trava de 1 cliente por slot** - No backend (Edge Function/RLS), ao cliente comprar videochamada, verificar se o slot ja foi comprado OU se tem live nesse horario. Rejeitar se conflito.

#### Bloco 2 - Conteudo (rapido de resolver)
3. **C1 - Editar pacote** - Conectar RPC `update_pack_with_items` na pagina de edicao. A infra ja existe, so falta a UI.

#### Bloco 3 - Live (ajustes pontuais)
4. **L2 - Cancelar evento** - Adicionar botao no modal de detalhes que faz UPDATE em `live_streams` com status = 'cancelled'
5. **L3 - Status automatico** - Logica no frontend para calcular status baseado no horario atual

#### Bloco 4 - Videochamada (creator web)
6. **V3 - Ver chamadas compradas** - Creator precisa ver na agenda as videochamadas que clientes compraram
7. **V4 - Cancelar chamada** - Botao para creator cancelar chamada agendada

> **Nota:** V5 (Edge Function para compra de call pelo cliente) depende do app/web do cliente. Se o cliente ja tem essa funcionalidade no Flutter, pode nao ser prioridade para o creator web hoje.

---

## ARQUIVOS PRINCIPAIS POR FEATURE

### Live
- `app/(app)/home/page.tsx` - Dashboard com eventos do dia
- `app/(app)/schedule/page.tsx` - Agenda completa
- `components/home/NovoEventoModal.tsx` - Modal de criar live
- `components/home/CardEvento.tsx` - Card de evento
- `components/schedule/DetalhesAgendamentoModal.tsx` - Modal detalhes
- `lib/types/database.ts` - Tipos (live_streams, live_stream_tickets)

### Videochamada
- `app/(app)/home/page.tsx` - Botao entrar na call
- `app/(app)/schedule/page.tsx` - Agenda com calls
- `app/(app)/profile/edit/interactions/page.tsx` - Config de precos
- `lib/types/database.ts` - Tipos (one_on_one_calls)
- `lib/api/schedule.ts` - APIs de disponibilidade

### Conteudo
- `app/(app)/content/page.tsx` - Lista de pacotes
- `app/(app)/content/create/page.tsx` - Criar pacote
- `app/(app)/content/[id]/edit/page.tsx` - Visualizar/Editar (PRECISA IMPLEMENTAR EDICAO)
- `lib/api/content.ts` - APIs (CRUD + Stripe)
- `lib/storage/packs.ts` - Upload de arquivos
- `components/content/PackVideoPlayer.tsx` - Player de video

---

## DECISOES NECESSARIAS

Antes de comecar, precisamos alinhar:

1. **Videochamada - Fluxo do cliente**: O cliente ja tem app/web para solicitar chamadas? Se nao, V3 (Edge Function) nao e prioridade hoje.
2. **Live - Status automatico**: Preferem trigger no banco (Supabase) ou logica no frontend?
3. **Conteudo - Edicao**: Permitir editar tudo (titulo, preco, midias) ou apenas titulo/descricao?
4. **Videochamada - Onde listar pendentes**: Nova pagina `/calls` ou secao na Home?
