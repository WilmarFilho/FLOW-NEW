alter table public.profile
  add column if not exists agendamento_automatico_ia boolean not null default true,
  add column if not exists alerta_atendentes_intervencao_ia boolean not null default true;

alter table public.whatsapp_connections
  add column if not exists business_hours jsonb not null default '{"timezone":"America/Sao_Paulo","days":{}}'::jsonb,
  add column if not exists appointment_slot_minutes integer not null default 60;

alter table public.conversas
  add column if not exists pending_schedule_options jsonb null,
  add column if not exists pending_schedule_context jsonb null,
  add column if not exists pending_schedule_expires_at timestamptz null;
