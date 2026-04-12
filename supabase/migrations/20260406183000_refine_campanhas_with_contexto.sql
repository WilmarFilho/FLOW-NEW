alter table public.campanhas
  add column if not exists contexto text null;

alter table public.campanhas
  alter column mensagem drop not null;

update public.campanhas
set contexto = coalesce(contexto, mensagem)
where contexto is null and mensagem is not null;

alter table public.campanhas_destinatarios
  add column if not exists mensagem_personalizada text null;
