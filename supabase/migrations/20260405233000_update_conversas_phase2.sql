alter table public.conversas_mensagens
  add column if not exists ai_context_text text null;

alter table public.conversas_lotes_recebimento
  add column if not exists last_error text null,
  add column if not exists processed_at timestamptz null;
