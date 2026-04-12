alter table public.campanhas
  alter column lista_id drop not null;

alter table public.campanhas
  add column if not exists source_type text not null default 'lista'
    check (source_type in ('lista', 'connection')),
  add column if not exists source_whatsapp_connection_id uuid null
    references public.whatsapp_connections(id) on delete restrict;

update public.campanhas
set source_type = 'lista'
where source_type is null;
