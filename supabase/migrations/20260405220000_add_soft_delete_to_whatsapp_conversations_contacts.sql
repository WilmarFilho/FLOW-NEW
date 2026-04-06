alter table public.whatsapp_connections
  add column if not exists deleted_at timestamptz null;

alter table public.contatos
  add column if not exists deleted_at timestamptz null;

alter table public.conversas
  add column if not exists deleted_at timestamptz null;

create index if not exists whatsapp_connections_user_deleted_idx
  on public.whatsapp_connections (user_id, deleted_at);

create index if not exists contatos_profile_deleted_idx
  on public.contatos (profile_id, deleted_at);

create index if not exists conversas_profile_deleted_idx
  on public.conversas (profile_id, deleted_at, last_message_at desc);
