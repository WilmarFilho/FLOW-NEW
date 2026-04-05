create extension if not exists "pgcrypto";

create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile(auth_id) on delete cascade,
  contato_id uuid not null references public.contatos(id) on delete cascade,
  whatsapp_connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  assigned_user_id uuid null references public.profile(auth_id) on delete set null,
  assigned_at timestamptz null,
  ai_enabled boolean not null default true,
  ai_disabled_at timestamptz null,
  status text not null default 'open' check (status in ('open', 'archived')),
  last_message_preview text null,
  last_message_at timestamptz not null default timezone('utc', now()),
  unread_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, contato_id, whatsapp_connection_id)
);

create index if not exists conversas_profile_last_message_idx
  on public.conversas (profile_id, last_message_at desc);

create index if not exists conversas_assigned_user_idx
  on public.conversas (assigned_user_id);

create table if not exists public.conversas_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  profile_id uuid not null references public.profile(auth_id) on delete cascade,
  whatsapp_connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  external_message_id text null,
  direction text not null check (direction in ('inbound', 'outbound', 'system')),
  sender_type text not null check (sender_type in ('customer', 'user', 'assistant', 'system')),
  sender_user_id uuid null references public.profile(auth_id) on delete set null,
  message_type text not null check (message_type in ('text', 'audio', 'image', 'video', 'sticker', 'unsupported')),
  content text null,
  media_url text null,
  media_path text null,
  media_mime_type text null,
  status text not null default 'received' check (status in ('received', 'sent', 'failed')),
  raw_payload jsonb null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (external_message_id)
);

create index if not exists conversas_mensagens_conversa_created_idx
  on public.conversas_mensagens (conversa_id, created_at asc);

create index if not exists conversas_mensagens_profile_created_idx
  on public.conversas_mensagens (profile_id, created_at desc);

create table if not exists public.conversas_lotes_recebimento (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  profile_id uuid not null references public.profile(auth_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  message_ids uuid[] not null default '{}',
  scheduled_for timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists conversas_lotes_recebimento_status_idx
  on public.conversas_lotes_recebimento (status, scheduled_for asc);

alter table public.conversas enable row level security;
alter table public.conversas_mensagens enable row level security;
alter table public.conversas_lotes_recebimento enable row level security;

create policy "conversas_select_owner_or_atendente"
  on public.conversas
  for select
  to authenticated
  using (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas.profile_id
        and conversas.whatsapp_connection_id = any(a.whatsapp_ids)
    )
  );

create policy "conversas_insert_owner_only"
  on public.conversas
  for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas.profile_id
        and conversas.whatsapp_connection_id = any(a.whatsapp_ids)
    )
  );

create policy "conversas_update_owner_or_atendente"
  on public.conversas
  for update
  to authenticated
  using (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas.profile_id
        and conversas.whatsapp_connection_id = any(a.whatsapp_ids)
    )
  )
  with check (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas.profile_id
        and conversas.whatsapp_connection_id = any(a.whatsapp_ids)
    )
  );

create policy "conversas_mensagens_select_owner_or_atendente"
  on public.conversas_mensagens
  for select
  to authenticated
  using (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas_mensagens.profile_id
        and conversas_mensagens.whatsapp_connection_id = any(a.whatsapp_ids)
    )
  );

create policy "conversas_mensagens_insert_owner_only"
  on public.conversas_mensagens
  for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas_mensagens.profile_id
        and conversas_mensagens.whatsapp_connection_id = any(a.whatsapp_ids)
    )
  );

create policy "conversas_mensagens_update_owner_only"
  on public.conversas_mensagens
  for update
  to authenticated
  using (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas_mensagens.profile_id
        and conversas_mensagens.whatsapp_connection_id = any(a.whatsapp_ids)
    )
  )
  with check (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas_mensagens.profile_id
        and conversas_mensagens.whatsapp_connection_id = any(a.whatsapp_ids)
    )
  );

create policy "conversas_lotes_select_owner_only"
  on public.conversas_lotes_recebimento
  for select
  to authenticated
  using (
    auth.uid() = profile_id
    or exists (
      select 1
      from public.atendentes a
      where a.profile_id = auth.uid()
        and a.admin_id = conversas_lotes_recebimento.profile_id
    )
  );

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

create policy "chat_media_read_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'chat-media');

create policy "chat_media_write_service_or_owner"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'chat-media');

alter publication supabase_realtime add table public.conversas;
alter publication supabase_realtime add table public.conversas_mensagens;
