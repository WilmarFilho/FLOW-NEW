-- Add whatsapp_ids column to atendentes table
ALTER TABLE public.atendentes ADD COLUMN IF NOT EXISTS whatsapp_ids UUID[] DEFAULT '{}';
