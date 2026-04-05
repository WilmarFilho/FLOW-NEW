alter table public.atendentes
  add column if not exists numero text null;

alter table public.conversas
  add column if not exists human_intervention_requested_at timestamptz null,
  add column if not exists human_intervention_reason text null,
  add column if not exists last_attendant_alert_at timestamptz null;
