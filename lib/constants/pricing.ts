// Regra de negócio herdada do app Flutter original: nenhum item vendido na
// plataforma pode custar menos de R$ 10,00 (packs, ingressos de live e
// videochamadas 30min/1h). Validado também server-side nas edge functions
// create-stripe-pack e create-stripe-live-ticket.

/** Preço mínimo (em reais) para qualquer item vendável na plataforma. */
export const MIN_PRICE_BRL = 10
