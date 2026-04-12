alter table public.whatsapp_connections
  add column if not exists cor text not null default '#22c55e';

create table if not exists public.contatos_whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile(auth_id) on delete cascade,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  whatsapp_connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (contato_id, whatsapp_connection_id)
);

alter table public.contatos_whatsapp_connections enable row level security;

create policy "Users can manage own contato connection presence"
  on public.contatos_whatsapp_connections for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Service role full access on contato connection presence"
  on public.contatos_whatsapp_connections to service_role
  using (true)
  with check (true);

insert into public.contatos_whatsapp_connections (
  profile_id,
  contato_id,
  whatsapp_connection_id,
  first_seen_at,
  last_seen_at
)
select distinct
  c.profile_id,
  c.contato_id,
  c.whatsapp_connection_id,
  coalesce(c.created_at, timezone('utc', now())),
  coalesce(c.updated_at, c.last_message_at, timezone('utc', now()))
from public.conversas c
where c.contato_id is not null
on conflict (contato_id, whatsapp_connection_id) do update
set
  last_seen_at = excluded.last_seen_at,
  updated_at = timezone('utc', now());

create index if not exists idx_contatos_whatsapp_connections_profile
  on public.contatos_whatsapp_connections (profile_id, contato_id);

create index if not exists idx_contatos_whatsapp_connections_connection
  on public.contatos_whatsapp_connections (whatsapp_connection_id);

alter publication supabase_realtime add table public.contatos_whatsapp_connections;
alter table public.contatos_whatsapp_connections replica identity full;
